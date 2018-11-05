const { google } = require('googleapis')
const scopes = ['https://www.googleapis.com/auth/analytics', 'https://www.googleapis.com/auth/analytics.edit']
const jwt = new google.auth.JWT(process.env.CLIENT_EMAIL, null, process.env.PRIVATE_KEY, scopes)
const moment = require('moment')
const fs = require('fs')
const dataFilePath = '.data/data.json'
const path = require('path')
const express = require('express')


const getFileUpdatedDate = (path) => {
  const stats = fs.statSync(path)
  return stats.mtime
}

const isToday = (someDate) => {
  const today = new Date()
  return someDate.getDate() == today.getDate() && 
    someDate.getMonth() == today.getMonth() && 
    someDate.getFullYear() == today.getFullYear()
}

const wasModifiedToday = (path) => {
  return isToday(getFileUpdatedDate(path))
}

const storeData = (data) => {
  try {
    fs.writeFileSync(dataFilePath, JSON.stringify(data))
  } catch (err) {
    console.error(err)
  }
}

const loadData = () => {
  try {
    const data = JSON.parse(fs.readFileSync(dataFilePath, 'utf8'))
    return data
  } catch (err) {
    console.error(err)
    return false
  }
}

async function getPropertiesList() {
  const response = await jwt.authorize()
  const result = await google.analytics('v3').management.webproperties.list({
    'auth': jwt,
    'accountId': process.env.ACCOUNT_ID
  })

  return result.data.items.map(item => { return item.defaultProfileId ? { name: item.name, id: item.defaultProfileId } : false })
}

async function getDailyData(viewId, startDate, endDate, organic = false) {
  const analyticsreporting = google.analyticsreporting({
    version: 'v4',
    auth: jwt
  })

  let filter = ''
  if (organic) {
    filter = 'ga:medium==organic'
  }
  
  const res = await analyticsreporting.reports.batchGet({
    requestBody: {
      reportRequests: [{
        viewId: viewId,
        dateRanges: [{
          startDate: startDate,
          endDate: endDate
        }],
        metrics: [{
          expression: 'ga:sessions'
        }],
        filtersExpression: filter
      }]
    }
  })
  
  return res.data.reports[0].data.totals[0].values[0]
}

async function getData() {
  const list = await getPropertiesList()
  
  const daysAgo30 = moment().subtract(30, 'days').format('YYYY-MM-DD')
  const daysAgo60 = moment().subtract(60, 'days').format('YYYY-MM-DD')
  
  const getDataOfItem = async item => {
    return {
      property: item,
      today: {
        total: (await getDailyData(item.id, 'today', 'today')),
        organic: await getDailyData(item.id, 'today', 'today', true),
      },
      yesterday: {
        total: await getDailyData(item.id, 'yesterday', 'yesterday'),
        organic: await getDailyData(item.id, 'yesterday', 'yesterday', true),
      },
      monthly: {
        total: await getDailyData(item.id, '30daysAgo', 'today'),
        improvement_total: await getDailyData(item.id, daysAgo60, daysAgo30),
        organic: await getDailyData(item.id, '30daysAgo', 'today', true),
        improvement_organic: await getDailyData(item.id, daysAgo60, daysAgo30, true)
      }
    }  
  }
  
  return await Promise.all(list.map(item => getDataOfItem(item)))
}

async function getTodayData() {
  const list = await getPropertiesList()
  
  const getDataOfItem = async item => {
    return {
      property: item,
      today: {
        total: (await getDailyData(item.id, 'today', 'today')),
        organic: await getDailyData(item.id, 'today', 'today', true),
      }
    }  
  }
  
  return await Promise.all(list.map(item => getDataOfItem(item)))
}

const getAnalyticsData = async () => {
  let data = null
  if (fs.existsSync(dataFilePath) && wasModifiedToday(dataFilePath)) {
    console.log('load from file')
    data = loadData()
  } else {
    console.log('load from GA')
    //fetch updated data from Google Analytics, and store it to the local file
    data = {
      aggregate: await getData()
    }
    
    storeData(data)
  }
  data.today = await getTodayData()
  
  data.sums = data.aggregate.reduce(( acc, current ) => {
    return {
        today: {
            total: parseInt(current.today.total) + parseInt(acc.today.total),  
            organic: parseInt(current.today.organic) + parseInt(acc.today.organic) 
        },
        yesterday: {
            total: parseInt(current.yesterday.total) + parseInt(acc.yesterday.total),  
            organic: parseInt(current.yesterday.organic) + parseInt(acc.yesterday.organic) 
        },
        monthly: {
            total: parseInt(current.monthly.total) + parseInt(acc.monthly.total),  
            organic: parseInt(current.monthly.organic) + parseInt(acc.monthly.organic) 
        }
    }
  }, {
    today: { total: 0, organic: 0},
    yesterday: { total: 0, organic: 0},
    monthly: { total: 0, organic: 0}
  })

  data.sites = data.aggregate.map(item => {
    return {
      name: item.property.name,
      id: item.property.id
    }
  })
  
	return data
}

const data = getAnalyticsData()

data.then(data => {
  const app = express()
  app.set('view engine', 'pug')
  app.set('views', path.join(__dirname, 'views'))
  app.use(express.static('public'));

  app.get('/', (req, res) => res.render('index', data ))
  app.get('/stats', (req, res) => {
    const site = req.query.site
    
    if (site === 'All') {
      res.json(data.sums)
      return
    } else {      
      const filteredData = data.aggregate.filter(item => item.property.name === site)
      res.json(filteredData[0])
    }
  })
  
  app.listen(3000, () => console.log('Server ready'))
})


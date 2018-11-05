document.addEventListener('DOMContentLoaded', (event) => {
  const buttons = document.querySelectorAll("#select .button")
  for (const button of buttons) {
    button.addEventListener('click', function(event) {
      for (const button of buttons) {
        button.classList.remove('active')
      }
      this.classList.add('active')
      
      const organicStats = document.querySelectorAll('#stats .organic')
      const totalStats = document.querySelectorAll('#stats .total')
      
      if (this.classList.contains('organic')) {
        for (const item of organicStats) {
          item.classList.remove('hidden')
        }
        for (const item of totalStats) {
          item.classList.add('hidden')
        }
      } else {
        for (const item of organicStats) {
          item.classList.add('hidden')
        }
        for (const item of totalStats) {
          item.classList.remove('hidden')
        }
      }
      
      event.preventDefault()
    })
  }
  
  const fetchStats = (site) => {
    fetch('/stats?site=' + encodeURIComponent(site)).then(response => response.json())
      .then(body => {
      document.querySelector('#today .total').innerText = body.today.total
      document.querySelector('#today .organic').innerText = body.today.organic
      document.querySelector('#yesterday .total').innerText = body.yesterday.total
      document.querySelector('#yesterday .organic').innerText = body.yesterday.organic
      document.querySelector('#monthly .total').innerText = body.monthly.total
      document.querySelector('#monthly .organic').innerText = body.monthly.organic                             
    })
    .catch(err => console.error(err))
  }
  
  const sidebarLinks = document.querySelectorAll("#sidebar li")
  
  for (const sidebarLink of sidebarLinks) {
    sidebarLink.addEventListener('click', function(event) {
      for (const sidebarLink of sidebarLinks) {
        sidebarLink.classList.remove('active')
      }
      this.classList.add('active')
      fetchStats(this.textContent)
    })
  }
                              
})
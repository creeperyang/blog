const Vue = require('./dist/core/instance').default

Vue.options = Object.create(null)

const vm = new Vue({
  data() {
    return { title: 'halo' }
  },
  render(h) {
    console.log('render')
    return h('h1', this.title)
  }
})

console.log(vm)

const { observe } = require('./dist/core/observer')
const Watcher = require('./dist/core/observer/watcher').default

function createWather(data, expOrFn, cb, options) {
  const vm = {
    data: data || {},
    _watchers: []
  }
  observe(vm.data, true)
  return new Watcher(vm, expOrFn, cb, options)
}

const raw = {
  s: 'hi',
  n: 100,
  o: {x: 1, arr: [1, 2]},
  arr: [8, 9]
}

const w = createWather(raw, function () {
  return this.data.arr
}, (a, b) => {
  console.log('--->', a, b)
}, {
  deep: false,
  sync: true
})

raw.arr.push(10)

import init from './index'
import h from './h'
import propsModule from './modules/props'
import styleModule from './modules/style'
import classModule from './modules/class'

const patch = init([
  classModule,
  propsModule,
  styleModule
])

export const snabbdomBuddle = { patch, h }
export default snabbdomBuddle
import React from 'react'
import {
  BrowserRouter as Router,
  Link
} from 'react-router-dom'
import router from './router'

const App = () => (
    <Router>
      <div>
        <ul>
          <li><Link to="/">首页</Link></li>
          <li><Link to="/about">关于0</Link></li>
        </ul>

        <hr/>
        {router()}
      </div>
    </Router>
)

export default App

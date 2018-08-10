import React from 'react'
import {
    Route,
    Switch
} from 'react-router-dom'
import asyncComponent from './AsyncComponent'

const Home = asyncComponent(() => import('./containers/Home'))
const About = asyncComponent(() => import('./containers/About'))

const router = () => (
    <Switch>
        <Route path="/" exact component={Home} />
        <Route path="/about" component={About} />
        <Route component={About} />
    </Switch>
)

export default router

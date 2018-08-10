import React, {
    Component
} from 'react'

// https://serverless-stack.com/chapters/code-splitting-in-create-react-app.html
export default function asyncComponent(importComponent) {
    class AsyncComponent extends Component {
        constructor(props) {
            super(props)

            this.state = {
                component: null
            }
        }

        async componentDidMount() {
            const {
                default: component
            } = await importComponent()

            this.setState({
                component: component
            })
        }

        render() {
            const C = this.state.component

            return C ? <C {...this.props} /> : null
        }
    }

    return AsyncComponent
}
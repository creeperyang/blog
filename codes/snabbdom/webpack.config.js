const { join } = require('path')
const HtmlWebpackPlugin = require('html-webpack-plugin')

module.exports = {
  entry: './demo/app.js',
  output: {
    filename: 'bundle.js',
    path: join(__dirname, 'dist')
  },
  plugins: [
    new HtmlWebpackPlugin({
      title: 'snabbdom',
      template: 'demo/index.ejs'
    })
  ]
}

const { join } = require('path')
const HtmlWebpackPlugin = require('html-webpack-plugin')

module.exports = [
  {
    entry: './src/export.js',
    output: {
      libraryTarget: 'umd',
      libraryExport: 'default',
      library: 'snabbdom',
      filename: 'snabbdom.js',
      path: join(__dirname, 'dist')
    }
  },
  {
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
]

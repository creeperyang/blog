const merge = require('webpack-merge')
const path = require('path')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const commonConfig = require('./webpack.common.config')

const devConfig = {
    devtool: 'inline-source-map',
    entry: {
        app: [
            // 'babel-polyfill',
            // 'react-hot-loader/patch',
            path.join(__dirname, '../client/index.js')
        ]
    },
    output: {
        filename: `[name].[hash].js`,
        chunkFilename: `[name].[hash].js`,
    },
    devServer: {
        port: 8090,
        contentBase: path.join(__dirname, '../dist'),
        historyApiFallback: true,
        host: '0.0.0.0',
        proxy: {
            '/api': {
                target: 'https://qa-dumall.baidu.com/',
                changeOrigin: true
            },
        }
    },
    plugins: [
        // new webpack.HashedModuleIdsPlugin(),
        new HtmlWebpackPlugin({
            template: path.join(__dirname, '../client/index.ejs'),
            templateParameters: {
                GLOBAL_ENV: 'dev'
            },
            // favicon: 'favicon.ico'
        }),
    ],
    optimization: {
        splitChunks: {
            name: true,
            cacheGroups: {
                commons: {
                    chunks: 'initial',
                    minChunks: 2
                },
                vendors: {
                    test: /[\\/]node_modules[\\/]/i,
                    chunks: 'all',
                    priority: -10
                }
            }
        },
        runtimeChunk: false
    },
};

module.exports = merge({
    customizeArray(a, b, key) {
        // entry.app不合并，全替换
        if (key === 'entry.app') {
            return b;
        }
        return undefined;
    }
})(commonConfig, devConfig);

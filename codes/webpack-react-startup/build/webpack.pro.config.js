const merge = require('webpack-merge')
const path = require('path')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin

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
    mode: 'production',
    output: {
        filename: `[name].[chunkhash].js`,
        chunkFilename: `[name].[chunkhash].js`,
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
        new BundleAnalyzerPlugin(),
    ],
    optimization: {
        // pro 默认 true
        minimize: true,
        // minimizer，提供机会覆盖 UglifyjsWebpackPlugin
        // Use readable module identifiers for better debugging，默认 false
        namedModules: false,
        // Use readable chunk identifiers for better debugging，默认 false
        namedChunks: false,
        // Tells webpack to determine and flag chunks which are subsets of other chunks
        // in a way that subsets don’t have to be loaded when the bigger chunk has been
        // already loaded. 默认是 true
        flagIncludedChunks: true,
        // Tells webpack to figure out an order of modules which will result in the 
        // smallest initial bundle. 默认是 true
        occurrenceOrder: true,
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

const path = require('path');

module.exports = {
    mode: 'development',
    entry: './src/admin/index.js',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'admin-bundle.js'
    },
    module: {
        rules: [
            {
                test: /\.css$/,
                use: [
                    'style-loader',  // Injects CSS into the DOM
                    'css-loader'     // Translates CSS into CommonJS
                ]
            }
            // ... any other rules you might have ...
        ]
    }
}; 
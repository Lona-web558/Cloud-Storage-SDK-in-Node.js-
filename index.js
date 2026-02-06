/**
 * Cloud Storage SDK with HTTP Server
 * Standalone implementation - everything in one file
 * Run with: node cloud-storage-server.js
 */

var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var http = require('http');
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var url = require('url');

// ============================================================================
// CloudStorage Class Definition
// ============================================================================

/**
 * CloudStorage Constructor
 * @param {Object} config - Configuration object
 */
function CloudStorage(config) {
    EventEmitter.call(this);
    
    this.config = {
        apiKey: config.apiKey || '',
        apiSecret: config.apiSecret || '',
        bucketName: config.bucketName || '',
        region: config.region || 'us-east-1',
        endpoint: config.endpoint || 'storage.example.com',
        useHttps: config.useHttps !== false,
        timeout: config.timeout || 30000,
        maxRetries: config.maxRetries || 3,
        serverPort: config.serverPort || 3000,
        serverHost: config.serverHost || 'localhost'
    };
    
    this.storage = {};
    this.localStoragePath = config.localStoragePath || path.join(__dirname, 'storage');
    this.server = null;
    this.uploadDir = path.join(__dirname, 'uploads');
    
    this._initializeStorage();
}

util.inherits(CloudStorage, EventEmitter);

/**
 * Initialize local storage directory
 * @private
 */
CloudStorage.prototype._initializeStorage = function() {
    var self = this;
    
    if (!fs.existsSync(self.localStoragePath)) {
        fs.mkdirSync(self.localStoragePath, { recursive: true });
    }
    
    if (!fs.existsSync(self.uploadDir)) {
        fs.mkdirSync(self.uploadDir, { recursive: true });
    }
    
    console.log('Cloud Storage SDK initialized');
    console.log('Bucket:', self.config.bucketName);
    console.log('Region:', self.config.region);
};

/**
 * Generate unique file ID
 * @private
 * @returns {String} Unique ID
 */
CloudStorage.prototype._generateFileId = function() {
    return crypto.randomBytes(16).toString('hex');
};

/**
 * Calculate file hash
 * @private
 * @param {String} filePath - Path to file
 * @param {Function} callback - Callback function
 */
CloudStorage.prototype._calculateHash = function(filePath, callback) {
    var hash = crypto.createHash('sha256');
    var stream = fs.createReadStream(filePath);
    
    stream.on('data', function(data) {
        hash.update(data);
    });
    
    stream.on('end', function() {
        callback(null, hash.digest('hex'));
    });
    
    stream.on('error', function(err) {
        callback(err);
    });
};

/**
 * Upload file to cloud storage
 * @param {String} filePath - Local file path
 * @param {Object} options - Upload options
 * @param {Function} callback - Callback function
 */
CloudStorage.prototype.upload = function(filePath, options, callback) {
    var self = this;
    
    if (typeof options === 'function') {
        callback = options;
        options = {};
    }
    
    options = options || {};
    
    fs.stat(filePath, function(err, stats) {
        if (err) {
            return callback(err);
        }
        
        if (!stats.isFile()) {
            return callback(new Error('Path is not a file'));
        }
        
        var fileId = self._generateFileId();
        var fileName = options.fileName || path.basename(filePath);
        var destinationPath = path.join(self.localStoragePath, fileId);
        
        self._calculateHash(filePath, function(err, hash) {
            if (err) {
                return callback(err);
            }
            
            var readStream = fs.createReadStream(filePath);
            var writeStream = fs.createWriteStream(destinationPath);
            
            readStream.on('error', function(err) {
                callback(err);
            });
            
            writeStream.on('error', function(err) {
                callback(err);
            });
            
            writeStream.on('finish', function() {
                var fileInfo = {
                    fileId: fileId,
                    fileName: fileName,
                    originalPath: filePath,
                    storagePath: destinationPath,
                    size: stats.size,
                    hash: hash,
                    contentType: options.contentType || 'application/octet-stream',
                    metadata: options.metadata || {},
                    uploadedAt: new Date().toISOString(),
                    bucket: self.config.bucketName
                };
                
                self.storage[fileId] = fileInfo;
                
                self.emit('upload', fileInfo);
                
                console.log('File uploaded successfully:', fileName);
                callback(null, fileInfo);
            });
            
            readStream.pipe(writeStream);
        });
    });
};

/**
 * Download file from cloud storage
 * @param {String} fileId - File ID
 * @param {String} destinationPath - Local destination path
 * @param {Function} callback - Callback function
 */
CloudStorage.prototype.download = function(fileId, destinationPath, callback) {
    var self = this;
    
    if (!self.storage[fileId]) {
        return callback(new Error('File not found'));
    }
    
    var fileInfo = self.storage[fileId];
    var sourcePath = fileInfo.storagePath;
    
    fs.stat(sourcePath, function(err, stats) {
        if (err) {
            return callback(err);
        }
        
        var readStream = fs.createReadStream(sourcePath);
        var writeStream = fs.createWriteStream(destinationPath);
        
        readStream.on('error', function(err) {
            callback(err);
        });
        
        writeStream.on('error', function(err) {
            callback(err);
        });
        
        writeStream.on('finish', function() {
            self.emit('download', fileInfo);
            
            console.log('File downloaded successfully:', fileInfo.fileName);
            callback(null, {
                fileId: fileId,
                fileName: fileInfo.fileName,
                downloadPath: destinationPath,
                size: stats.size
            });
        });
        
        readStream.pipe(writeStream);
    });
};

/**
 * Delete file from cloud storage
 * @param {String} fileId - File ID
 * @param {Function} callback - Callback function
 */
CloudStorage.prototype.delete = function(fileId, callback) {
    var self = this;
    
    if (!self.storage[fileId]) {
        return callback(new Error('File not found'));
    }
    
    var fileInfo = self.storage[fileId];
    var filePath = fileInfo.storagePath;
    
    fs.unlink(filePath, function(err) {
        if (err && err.code !== 'ENOENT') {
            return callback(err);
        }
        
        delete self.storage[fileId];
        
        self.emit('delete', fileInfo);
        
        console.log('File deleted successfully:', fileInfo.fileName);
        callback(null, { fileId: fileId, deleted: true });
    });
};

/**
 * List all files in storage
 * @param {Object} options - List options
 * @param {Function} callback - Callback function
 */
CloudStorage.prototype.list = function(options, callback) {
    var self = this;
    
    if (typeof options === 'function') {
        callback = options;
        options = {};
    }
    
    options = options || {};
    
    var files = [];
    var fileIds = Object.keys(self.storage);
    
    for (var i = 0; i < fileIds.length; i++) {
        var fileId = fileIds[i];
        var fileInfo = self.storage[fileId];
        
        files.push({
            fileId: fileInfo.fileId,
            fileName: fileInfo.fileName,
            size: fileInfo.size,
            contentType: fileInfo.contentType,
            uploadedAt: fileInfo.uploadedAt,
            metadata: fileInfo.metadata
        });
    }
    
    if (options.prefix) {
        files = files.filter(function(file) {
            return file.fileName.startsWith(options.prefix);
        });
    }
    
    if (options.limit) {
        files = files.slice(0, options.limit);
    }
    
    callback(null, {
        files: files,
        count: files.length,
        bucket: self.config.bucketName
    });
};

/**
 * Get file information
 * @param {String} fileId - File ID
 * @param {Function} callback - Callback function
 */
CloudStorage.prototype.getFileInfo = function(fileId, callback) {
    var self = this;
    
    if (!self.storage[fileId]) {
        return callback(new Error('File not found'));
    }
    
    var fileInfo = self.storage[fileId];
    
    fs.stat(fileInfo.storagePath, function(err, stats) {
        if (err) {
            return callback(err);
        }
        
        callback(null, {
            fileId: fileInfo.fileId,
            fileName: fileInfo.fileName,
            size: stats.size,
            hash: fileInfo.hash,
            contentType: fileInfo.contentType,
            metadata: fileInfo.metadata,
            uploadedAt: fileInfo.uploadedAt,
            lastModified: stats.mtime.toISOString()
        });
    });
};

/**
 * Get storage statistics
 * @param {Function} callback - Callback function
 */
CloudStorage.prototype.getStats = function(callback) {
    var self = this;
    var stats = {
        totalFiles: 0,
        totalSize: 0,
        bucket: self.config.bucketName
    };
    
    var fileIds = Object.keys(self.storage);
    stats.totalFiles = fileIds.length;
    
    var processed = 0;
    
    if (fileIds.length === 0) {
        return callback(null, stats);
    }
    
    fileIds.forEach(function(fileId) {
        var fileInfo = self.storage[fileId];
        
        fs.stat(fileInfo.storagePath, function(err, fileStat) {
            if (!err) {
                stats.totalSize += fileStat.size;
            }
            
            processed++;
            
            if (processed === fileIds.length) {
                callback(null, stats);
            }
        });
    });
};

// ============================================================================
// HTTP Server Methods
// ============================================================================

/**
 * Parse multipart form data
 * @private
 */
CloudStorage.prototype._parseMultipart = function(buffer, boundary, callback) {
    var parts = [];
    var boundaryBuffer = Buffer.from('--' + boundary);
    var position = 0;
    
    while (position < buffer.length) {
        var boundaryPos = buffer.indexOf(boundaryBuffer, position);
        if (boundaryPos === -1) break;
        
        var nextBoundary = buffer.indexOf(boundaryBuffer, boundaryPos + boundaryBuffer.length);
        if (nextBoundary === -1) nextBoundary = buffer.length;
        
        var part = buffer.slice(boundaryPos + boundaryBuffer.length, nextBoundary);
        
        var headerEnd = part.indexOf('\r\n\r\n');
        if (headerEnd !== -1) {
            var headers = part.slice(0, headerEnd).toString();
            var content = part.slice(headerEnd + 4, part.length - 2);
            
            var nameMatch = headers.match(/name="([^"]+)"/);
            var filenameMatch = headers.match(/filename="([^"]+)"/);
            
            if (nameMatch) {
                parts.push({
                    name: nameMatch[1],
                    filename: filenameMatch ? filenameMatch[1] : null,
                    data: content,
                    headers: headers
                });
            }
        }
        
        position = nextBoundary;
    }
    
    callback(null, parts);
};

/**
 * Send JSON response
 * @private
 */
CloudStorage.prototype._sendJSON = function(res, statusCode, data) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
};

/**
 * Handle file upload via HTTP
 * @private
 */
CloudStorage.prototype._handleUpload = function(req, res) {
    var self = this;
    var chunks = [];
    
    req.on('data', function(chunk) {
        chunks.push(chunk);
    });
    
    req.on('end', function() {
        var buffer = Buffer.concat(chunks);
        var contentType = req.headers['content-type'] || '';
        var boundaryMatch = contentType.match(/boundary=(.+)$/);
        
        if (!boundaryMatch) {
            return self._sendJSON(res, 400, { 
                error: 'No boundary found in multipart data' 
            });
        }
        
        var boundary = boundaryMatch[1];
        
        self._parseMultipart(buffer, boundary, function(err, parts) {
            if (err || parts.length === 0) {
                return self._sendJSON(res, 400, { 
                    error: 'Failed to parse upload data' 
                });
            }
            
            var filePart = parts.find(function(p) { return p.filename; });
            if (!filePart) {
                return self._sendJSON(res, 400, { 
                    error: 'No file found in upload' 
                });
            }
            
            var tempPath = path.join(self.uploadDir, Date.now() + '-' + filePart.filename);
            
            fs.writeFile(tempPath, filePart.data, function(err) {
                if (err) {
                    return self._sendJSON(res, 500, { 
                        error: 'Failed to save file: ' + err.message 
                    });
                }
                
                var metadata = {};
                parts.forEach(function(part) {
                    if (part.name === 'metadata') {
                        try {
                            metadata = JSON.parse(part.data.toString());
                        } catch (e) {
                            // Ignore parse errors
                        }
                    }
                });
                
                self.upload(tempPath, {
                    fileName: filePart.filename,
                    metadata: metadata
                }, function(err, result) {
                    fs.unlink(tempPath, function() {});
                    
                    if (err) {
                        return self._sendJSON(res, 500, { 
                            error: err.message 
                        });
                    }
                    
                    self._sendJSON(res, 200, {
                        success: true,
                        file: result
                    });
                });
            });
        });
    });
};

/**
 * Handle file download via HTTP
 * @private
 */
CloudStorage.prototype._handleDownload = function(req, res, fileId) {
    var self = this;
    
    if (!self.storage[fileId]) {
        return self._sendJSON(res, 404, { 
            error: 'File not found' 
        });
    }
    
    var fileInfo = self.storage[fileId];
    var filePath = fileInfo.storagePath;
    
    fs.stat(filePath, function(err, stats) {
        if (err) {
            return self._sendJSON(res, 404, { 
                error: 'File not found on disk' 
            });
        }
        
        res.writeHead(200, {
            'Content-Type': fileInfo.contentType || 'application/octet-stream',
            'Content-Length': stats.size,
            'Content-Disposition': 'attachment; filename="' + fileInfo.fileName + '"'
        });
        
        var readStream = fs.createReadStream(filePath);
        readStream.pipe(res);
        
        readStream.on('error', function(err) {
            res.end();
        });
    });
};

/**
 * Handle file deletion via HTTP
 * @private
 */
CloudStorage.prototype._handleDelete = function(req, res, fileId) {
    var self = this;
    
    self.delete(fileId, function(err, result) {
        if (err) {
            return self._sendJSON(res, 404, { 
                error: err.message 
            });
        }
        
        self._sendJSON(res, 200, {
            success: true,
            result: result
        });
    });
};

/**
 * Handle list files via HTTP
 * @private
 */
CloudStorage.prototype._handleList = function(req, res, query) {
    var self = this;
    var options = {};
    
    if (query.prefix) options.prefix = query.prefix;
    if (query.limit) options.limit = parseInt(query.limit);
    
    self.list(options, function(err, result) {
        if (err) {
            return self._sendJSON(res, 500, { 
                error: err.message 
            });
        }
        
        self._sendJSON(res, 200, {
            success: true,
            result: result
        });
    });
};

/**
 * Handle get file info via HTTP
 * @private
 */
CloudStorage.prototype._handleGetInfo = function(req, res, fileId) {
    var self = this;
    
    self.getFileInfo(fileId, function(err, info) {
        if (err) {
            return self._sendJSON(res, 404, { 
                error: err.message 
            });
        }
        
        self._sendJSON(res, 200, {
            success: true,
            info: info
        });
    });
};

/**
 * Handle get storage stats via HTTP
 * @private
 */
CloudStorage.prototype._handleStats = function(req, res) {
    var self = this;
    
    self.getStats(function(err, stats) {
        if (err) {
            return self._sendJSON(res, 500, { 
                error: err.message 
            });
        }
        
        self._sendJSON(res, 200, {
            success: true,
            stats: stats
        });
    });
};

/**
 * Start HTTP server
 * @param {Function} callback - Callback function
 */
CloudStorage.prototype.startServer = function(callback) {
    var self = this;
    
    if (self.server) {
        return callback(new Error('Server already running'));
    }
    
    self.server = http.createServer(function(req, res) {
        var parsedUrl = url.parse(req.url, true);
        var pathname = parsedUrl.pathname;
        var query = parsedUrl.query;
        var method = req.method;
        
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        
        if (method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }
        
        console.log(method, pathname);
        
        if (method === 'POST' && pathname === '/upload') {
            return self._handleUpload(req, res);
        }
        
        if (method === 'GET' && pathname.startsWith('/download/')) {
            var fileId = pathname.split('/')[2];
            return self._handleDownload(req, res, fileId);
        }
        
        if (method === 'DELETE' && pathname.startsWith('/delete/')) {
            var fileId = pathname.split('/')[2];
            return self._handleDelete(req, res, fileId);
        }
        
        if (method === 'GET' && pathname === '/list') {
            return self._handleList(req, res, query);
        }
        
        if (method === 'GET' && pathname.startsWith('/info/')) {
            var fileId = pathname.split('/')[2];
            return self._handleGetInfo(req, res, fileId);
        }
        
        if (method === 'GET' && pathname === '/stats') {
            return self._handleStats(req, res);
        }
        
        if (method === 'GET' && pathname === '/') {
            return self._sendJSON(res, 200, {
                name: 'Cloud Storage API',
                version: '1.0.0',
                endpoints: {
                    'POST /upload': 'Upload a file',
                    'GET /download/:fileId': 'Download a file',
                    'DELETE /delete/:fileId': 'Delete a file',
                    'GET /list': 'List all files',
                    'GET /info/:fileId': 'Get file information',
                    'GET /stats': 'Get storage statistics'
                }
            });
        }
        
        self._sendJSON(res, 404, { 
            error: 'Endpoint not found' 
        });
    });
    
    self.server.listen(self.config.serverPort, self.config.serverHost, function() {
        console.log('\n===========================================');
        console.log('Cloud Storage Server Started');
        console.log('===========================================');
        console.log('Server running at http://' + self.config.serverHost + ':' + self.config.serverPort);
        console.log('Bucket:', self.config.bucketName);
        console.log('\nAvailable endpoints:');
        console.log('  POST   /upload              - Upload a file');
        console.log('  GET    /download/:fileId    - Download a file');
        console.log('  DELETE /delete/:fileId      - Delete a file');
        console.log('  GET    /list                - List all files');
        console.log('  GET    /info/:fileId        - Get file info');
        console.log('  GET    /stats               - Get storage stats');
        console.log('===========================================\n');
        
        if (callback) callback(null);
    });
    
    self.server.on('error', function(err) {
        console.error('Server error:', err.message);
        if (callback) callback(err);
    });
};

/**
 * Stop HTTP server
 * @param {Function} callback - Callback function
 */
CloudStorage.prototype.stopServer = function(callback) {
    var self = this;
    
    if (!self.server) {
        return callback(new Error('Server not running'));
    }
    
    self.server.close(function() {
        console.log('Cloud Storage Server stopped');
        self.server = null;
        if (callback) callback(null);
    });
};

// ============================================================================
// Start the Server
// ============================================================================

var storage = new CloudStorage({
    apiKey: 'your-api-key',
    apiSecret: 'your-api-secret',
    bucketName: 'my-bucket',
    region: 'us-east-1',
    localStoragePath: path.join(__dirname, 'storage'),
    serverPort: 3000,
    serverHost: 'localhost'
});

storage.on('upload', function(fileInfo) {
    console.log('[EVENT] File uploaded:', fileInfo.fileName, '(ID:', fileInfo.fileId + ')');
});

storage.on('download', function(fileInfo) {
    console.log('[EVENT] File downloaded:', fileInfo.fileName);
});

storage.on('delete', function(fileInfo) {
    console.log('[EVENT] File deleted:', fileInfo.fileName);
});

storage.startServer(function(err) {
    if (err) {
        console.error('Failed to start server:', err.message);
        process.exit(1);
    }
    
    console.log('Server is ready to accept requests!');
    console.log('\nTry these commands:');
    console.log('\n1. Upload a file:');
    console.log('   curl -X POST -F "file=@yourfile.txt" http://localhost:3000/upload');
    console.log('\n2. List files:');
    console.log('   curl http://localhost:3000/list');
    console.log('\n3. Get storage stats:');
    console.log('   curl http://localhost:3000/stats');
    console.log('\nPress Ctrl+C to stop the server');
});

process.on('SIGINT', function() {
    console.log('\nShutting down server...');
    storage.stopServer(function(err) {
        if (err) {
            console.error('Error stopping server:', err.message);
        }
        process.exit(0);
    });
});

process.on('SIGTERM', function() {
    console.log('\nShutting down server...');
    storage.stopServer(function(err) {
        if (err) {
            console.error('Error stopping server:', err.message);
        }
        process.exit(0);
    });
});

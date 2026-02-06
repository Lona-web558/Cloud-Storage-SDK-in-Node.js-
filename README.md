# Cloud-Storage-SDK-in-Node.js-
Cloud Storage SDK in Node.js 

# Cloud Storage SDK

A traditional JavaScript implementation of a Cloud Storage SDK for Node.js with HTTP server support. This SDK provides file management capabilities including upload, download, delete, list, and metadata operations, accessible both programmatically and via HTTP API.

## Features

- ✅ File upload with metadata
- ✅ File download
- ✅ File deletion
- ✅ List files with filters
- ✅ Copy files
- ✅ Update file metadata
- ✅ Get file information
- ✅ Storage statistics
- ✅ **HTTP Server (Localhost) with REST API**
- ✅ **Web-based client interface**
- ✅ Event emitters for operations
- ✅ File hashing (SHA-256)
- ✅ Traditional JavaScript (ES5 compatible)
- ✅ No external dependencies beyond Node.js core modules

## Installation

Simply copy the `cloud-storage-sdk.js` file to your project directory.

```bash
# No npm install needed - uses only Node.js core modules
```

## Usage

### HTTP Server Mode (NEW!)

Start the cloud storage server with HTTP API:

```javascript
var CloudStorage = require('./cloud-storage-sdk');
var path = require('path');

var storage = new CloudStorage({
    apiKey: 'your-api-key',
    apiSecret: 'your-api-secret',
    bucketName: 'my-bucket',
    localStoragePath: path.join(__dirname, 'storage'),
    serverPort: 3000,
    serverHost: 'localhost'
});

// Start the server
storage.startServer(function(err) {
    if (err) {
        console.error('Failed to start server:', err);
        return;
    }
    console.log('Server running at http://localhost:3000');
});
```

The server provides these HTTP endpoints:

- **POST /upload** - Upload a file
- **GET /download/:fileId** - Download a file
- **DELETE /delete/:fileId** - Delete a file
- **GET /list** - List all files
- **GET /info/:fileId** - Get file information
- **GET /stats** - Get storage statistics

### Basic Example

```javascript
var CloudStorage = require('./cloud-storage-sdk');
var path = require('path');

// Initialize the SDK
var storage = new CloudStorage({
    apiKey: 'your-api-key',
    apiSecret: 'your-api-secret',
    bucketName: 'my-bucket',
    region: 'us-east-1',
    localStoragePath: path.join(__dirname, 'storage')
});

// Upload a file
storage.upload('/path/to/file.txt', {
    fileName: 'uploaded-file.txt',
    contentType: 'text/plain',
    metadata: {
        author: 'John Doe'
    }
}, function(err, result) {
    if (err) {
        console.error('Upload failed:', err);
        return;
    }
    
    console.log('File uploaded!');
    console.log('File ID:', result.fileId);
});
```

## Configuration

### Constructor Options

```javascript
var storage = new CloudStorage({
    apiKey: 'string',           // API key for authentication
    apiSecret: 'string',        // API secret for authentication
    bucketName: 'string',       // Name of the storage bucket
    region: 'string',           // Region (default: 'us-east-1')
    endpoint: 'string',         // Storage endpoint (default: 'storage.example.com')
    localStoragePath: 'string', // Local storage directory path
    useHttps: true,             // Use HTTPS (default: true)
    timeout: 30000,             // Request timeout in ms (default: 30000)
    maxRetries: 3,              // Max retry attempts (default: 3)
    serverPort: 3000,           // HTTP server port (default: 3000)
    serverHost: 'localhost'     // HTTP server host (default: 'localhost')
});
```

## API Methods

### upload(filePath, options, callback)

Upload a file to cloud storage.

**Parameters:**
- `filePath` (String) - Path to the local file
- `options` (Object) - Upload options
  - `fileName` (String) - Custom file name
  - `contentType` (String) - MIME type
  - `metadata` (Object) - Custom metadata
- `callback` (Function) - Callback function (err, result)

**Example:**

```javascript
storage.upload('./document.pdf', {
    fileName: 'my-document.pdf',
    contentType: 'application/pdf',
    metadata: {
        category: 'documents',
        year: 2024
    }
}, function(err, result) {
    if (err) throw err;
    console.log('Uploaded:', result.fileId);
});
```

### download(fileId, destinationPath, callback)

Download a file from cloud storage.

**Parameters:**
- `fileId` (String) - Unique file identifier
- `destinationPath` (String) - Local destination path
- `callback` (Function) - Callback function (err, result)

**Example:**

```javascript
storage.download('abc123', './downloads/file.pdf', function(err, result) {
    if (err) throw err;
    console.log('Downloaded to:', result.downloadPath);
});
```

### delete(fileId, callback)

Delete a file from cloud storage.

**Parameters:**
- `fileId` (String) - Unique file identifier
- `callback` (Function) - Callback function (err, result)

**Example:**

```javascript
storage.delete('abc123', function(err, result) {
    if (err) throw err;
    console.log('File deleted:', result.deleted);
});
```

### list(options, callback)

List all files in storage.

**Parameters:**
- `options` (Object) - List options (optional)
  - `prefix` (String) - Filter by file name prefix
  - `limit` (Number) - Maximum number of results
- `callback` (Function) - Callback function (err, result)

**Example:**

```javascript
storage.list({ prefix: 'doc', limit: 10 }, function(err, result) {
    if (err) throw err;
    
    console.log('Found', result.count, 'files');
    result.files.forEach(function(file) {
        console.log(file.fileName);
    });
});
```

### getFileInfo(fileId, callback)

Get detailed information about a file.

**Parameters:**
- `fileId` (String) - Unique file identifier
- `callback` (Function) - Callback function (err, info)

**Example:**

```javascript
storage.getFileInfo('abc123', function(err, info) {
    if (err) throw err;
    
    console.log('File:', info.fileName);
    console.log('Size:', info.size);
    console.log('Hash:', info.hash);
});
```

### updateMetadata(fileId, metadata, callback)

Update file metadata.

**Parameters:**
- `fileId` (String) - Unique file identifier
- `metadata` (Object) - New metadata object
- `callback` (Function) - Callback function (err, result)

**Example:**

```javascript
storage.updateMetadata('abc123', {
    category: 'updated',
    version: '2.0'
}, function(err, result) {
    if (err) throw err;
    console.log('Metadata updated');
});
```

### copy(sourceFileId, options, callback)

Copy a file to create a duplicate.

**Parameters:**
- `sourceFileId` (String) - Source file identifier
- `options` (Object) - Copy options (optional)
  - `fileName` (String) - New file name
  - `metadata` (Object) - Metadata for the copy
- `callback` (Function) - Callback function (err, result)

**Example:**

```javascript
storage.copy('abc123', {
    fileName: 'copy-of-file.txt',
    metadata: { copy: true }
}, function(err, result) {
    if (err) throw err;
    console.log('Copy created:', result.fileId);
});
```

### getStats(callback)

Get storage statistics.

**Parameters:**
- `callback` (Function) - Callback function (err, stats)

**Example:**

```javascript
storage.getStats(function(err, stats) {
    if (err) throw err;
    
    console.log('Total files:', stats.totalFiles);
    console.log('Total size:', stats.totalSize, 'bytes');
});
```

### clear(callback)

Clear all files from storage (use with caution).

**Parameters:**
- `callback` (Function) - Callback function (err, result)

**Example:**

```javascript
storage.clear(function(err, result) {
    if (err) throw err;
    console.log('Deleted', result.deleted, 'files');
});
```

### startServer(callback)

Start the HTTP server.

**Parameters:**
- `callback` (Function) - Callback function (err)

**Example:**

```javascript
storage.startServer(function(err) {
    if (err) throw err;
    console.log('Server started!');
});
```

### stopServer(callback)

Stop the HTTP server.

**Parameters:**
- `callback` (Function) - Callback function (err)

**Example:**

```javascript
storage.stopServer(function(err) {
    if (err) throw err;
    console.log('Server stopped!');
});
```

## HTTP API Examples

### Using cURL

**Upload a file:**
```bash
curl -X POST -F "file=@document.pdf" http://localhost:3000/upload
```

**List all files:**
```bash
curl http://localhost:3000/list
```

**Download a file:**
```bash
curl http://localhost:3000/download/FILE_ID -o downloaded.pdf
```

**Delete a file:**
```bash
curl -X DELETE http://localhost:3000/delete/FILE_ID
```

**Get file info:**
```bash
curl http://localhost:3000/info/FILE_ID
```

**Get storage statistics:**
```bash
curl http://localhost:3000/stats
```

### Using JavaScript (Fetch API)

**Upload a file:**
```javascript
var formData = new FormData();
formData.append('file', fileInput.files[0]);

fetch('http://localhost:3000/upload', {
    method: 'POST',
    body: formData
})
.then(function(response) { return response.json(); })
.then(function(data) {
    console.log('Uploaded:', data.file.fileId);
});
```

**List files:**
```javascript
fetch('http://localhost:3000/list')
.then(function(response) { return response.json(); })
.then(function(data) {
    console.log('Files:', data.result.files);
});
```

## Web Client Interface

Open `client.html` in your web browser to use the visual interface:

1. Start the server: `node server-example.js`
2. Open `client.html` in your browser
3. Upload, download, and manage files through the UI

## Events

The SDK extends EventEmitter and emits the following events:

### upload

Emitted when a file is successfully uploaded.

```javascript
storage.on('upload', function(fileInfo) {
    console.log('File uploaded:', fileInfo.fileName);
});
```

### download

Emitted when a file is successfully downloaded.

```javascript
storage.on('download', function(fileInfo) {
    console.log('File downloaded:', fileInfo.fileName);
});
```

### delete

Emitted when a file is successfully deleted.

```javascript
storage.on('delete', function(fileInfo) {
    console.log('File deleted:', fileInfo.fileName);
});
```

## File Information Structure

When working with files, the SDK returns objects with the following structure:

```javascript
{
    fileId: 'abc123def456',           // Unique identifier
    fileName: 'document.pdf',          // File name
    originalPath: '/original/path',    // Original file path
    storagePath: '/storage/path',      // Storage path
    size: 1024,                        // File size in bytes
    hash: 'sha256hash',                // SHA-256 hash
    contentType: 'application/pdf',    // MIME type
    metadata: { /* custom data */ },   // Custom metadata
    uploadedAt: '2024-01-01T00:00:00Z', // Upload timestamp
    bucket: 'my-bucket'                // Bucket name
}
```

## Running the Examples

### Programmatic Usage

To run the example usage file:

```bash
node example-usage.js
```

This will demonstrate:
- Creating a test file
- Uploading the file
- Getting file information
- Listing all files
- Updating metadata
- Copying a file
- Downloading a file
- Getting storage statistics

### HTTP Server Mode

To run the HTTP server:

```bash
node server-example.js
```

This will:
- Start the server on http://localhost:3000
- Display available API endpoints
- Listen for incoming requests
- Log all operations

Then you can:
- Use cURL commands to interact with the API
- Open `client.html` in your browser for a visual interface
- Build your own client applications

## Error Handling

All methods use traditional Node.js callback pattern with error-first callbacks:

```javascript
storage.upload(filePath, options, function(err, result) {
    if (err) {
        // Handle error
        console.error('Error:', err.message);
        return;
    }
    
    // Success - use result
    console.log('Success:', result);
});
```

## Technical Details

- **Language:** Traditional JavaScript (ES5 compatible)
- **Style:** No arrow functions, uses `var` declarations
- **Modules:** Node.js core modules only
  - `fs` - File system operations
  - `path` - Path manipulation
  - `crypto` - Hash generation
  - `http/https` - HTTP operations
  - `events` - Event emitter
  - `util` - Utilities (inherits)

## License

This is example code for educational purposes.

## Support

For issues or questions, please refer to the example usage file or the inline documentation in the source code.


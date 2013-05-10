var http = require('http');
var url = require('url');
var mongodb = require('mongodb');
var ObjectID = mongodb.ObjectID;
var fs = require('fs');

/**
 * Receive and parse POST request.
 * @param req
 * @param callback
 */
function handlePOST (req, callback) {
  var body = '';
  req.on('data', function (data) {
    body += data;
    // Prevent massive attack.
    if (body.length > 1e6) {
      req.connection.destroy();
      callback();
    }
  });
  req.on('end', function () {
    var post;
    try {
       post = JSON.parse(body);
    } catch (e) {
      return callback(e);
    }
    return callback(null, post);
  });
}

// Our MongoDB connection settings.
process.env.MONGODB_HOST = '127.0.0.1';
process.env.MONGODB_PORT = 27017;
process.env.MONGODB_DB = 'stuff';

// Our HTTP server settings.
process.env.IP = '0.0.0.0';
process.env.PORT = 8080;

// Connect to our MongoDB server.
var mongoServer = new mongodb.Server(process.env.MONGODB_HOST, process.env.MONGODB_PORT, {});

// Open our MongoDB database.
var db = new mongodb.Db(process.env.MONGODB_DB, mongoServer, {w: 0});
db.open(function (err) {
  if (err) {
    throw err;
  }
});

// Store HTML in this file.
var html;

// Read HTML into memory.
fs.readFile(__dirname + '/app.html', 'UTF-8', function (err, data) {
  if (err) {
    throw err;
  }
  html = data;
});

// Create HTTP server.
http.createServer(function (req, res) {

  // Extract URL parts.
  var parts = url.parse(req.url, true);

  // Extract query.
  var query = parts.query;

  // Extract path name.
  var pathname = parts.pathname;

  if (pathname.match(new RegExp('^/api/document'))) {

    // Get document ID from query, if exists.
    var id = query.id;

    // Route based on whether document ID was passed.
    if (id) {

      // Convert string ID to MongoDB Object ID.
      try {
        id = new ObjectID(id);
      } catch (e) {
        res.writeHead(400);
        return res.end();
      }

      if (req.method === 'GET') {

        // Open our collection of documents.
        return db.collection('documents', function (err, col) {
          if (err) {
            throw err;
          }

          // Compose document query.
          var query = {
            _id: id
          };

          // Find one document.
          return col.findOne(query, function (err, doc) {
            if (err) {
              throw err;
            }
            var payload;

            // Did we find our document?
            if (doc) {
              res.writeHead(200, {
                'Content-Type': 'application/json'
              });
              payload = JSON.stringify(doc);
            } else {
              res.writeHead(404, {
                'Content-Type': 'application/json'
              });
              payload = null;
            }
            return res.end(payload);
          });
        });
      } else if (req.method === 'PUT') {

        // Receive data from front end.
        return handlePOST(req, function (err, data) {
          if (err) {
            throw err;
          }

          var document = {
            date: data.date
          };

          var query = {
            _id: id
          };

          // Upsert document.
          return db.collection('documents', function (err, col) {
            if (err) {
              throw err;
            }
            return col.update(query, document, function (err, data) {
              if (err) {
                throw err;
              }
              res.writeHead(200, {
                'Content-Type': 'application/json'
              });
              return res.end(JSON.stringify(data));
            });
          });
        });
      } else if (req.method === 'DELETE') {

        // Open our documents collection.
        return db.collection('documents', function (err, col) {
          if (err) {
            throw err;
          }

          // Compose query.
          var query = {
            _id: id
          };

          // Remove document that satisfied query, set "justOne" flag to true.
          return col.remove(query, 1, function (err) {
            if (err) {
              throw err;
            }
            return res.end();
          });
        });
      } else {

          // Unsupported or invalid method.
          res.writeHead(400);
          return res.end();
      }
    } else { /* We didn't get passed a document ID. */

      // Return all documents if document ID is not provided.
      if (req.method === 'GET') {

        // Open our collection of documents.
        return db.collection('documents', function (err, col) {
          if (err) {
            throw err;
          }

          // Find all objects.
          return col.find(query).toArray(function (err, docs) {
            if (err) {
              throw err;
            }
            var payload;

            // Does the collection contain any documents?
            if (docs) {
              res.writeHead(200, {
                'Content-Type': 'application/json'
              });
              payload = JSON.stringify(docs);
            } else {
              res.writeHead(404, {
                'Content-Type': 'application/json'
              });
              payload = null;
            }
            return res.end(payload);
          });
        });
      } else if (req.method === 'POST') { /* Save document to MongoDB. */

        // Receive data from front end.
        return handlePOST(req, function (err, data) {
          if (err) {
            throw err;
          }

          // Insert our new document.
          return db.collection('documents', function (err, col) {
            if (err) {
              throw err;
            }
            return col.insert(data, function (err, data) {
              if (err) {
                throw err;
              }
              res.writeHead(200, {
                'Content-Type': 'application/json'
              });
              return res.end(JSON.stringify(data[0]));
            });
          });
        });
      } else {

        // Unsupported or invalid method.
        res.writeHead(400);
        return res.end();
      }
    }
  } else {

    // Answer all unrecognized calls with app.html.
    res.writeHead(200, {
      'Content-Type': 'text/html'
    });
    return res.end(html);
  }
}).listen(process.env.PORT, process.env.IP);

#!/usr/bin/env node

var ENGINE_PATH = './engine.js'
  , dnode = require('dnode')
  , EventEmitter = require('events').EventEmitter
  , path = require('path')
  , Worker = require('webworker').Worker;

var CLI_PROCESSES = 4;

exports.start = function(master,id) {
  
  var emitter = new EventEmitter;
  var w = new Worker(path.resolve(__dirname, ENGINE_PATH));
  
  var client = dnode(function() {
    var self = this;
    
    self.role="worker";

    w.onmessage = function(e) {
      // LATEST_DATA = e.data;
      emitter.emit('result', e.data);
    };

    w.error = function (e) {
      throw new('Error from worker', e.message);
    }

    self.name = 'Worker '+id;

    this.compute = function (fen, timeout) {
      console.log('[' + self.name + '] Starting to work on ' + fen);
      w.postMessage({type: 'position', data: fen});
      w.postMessage({type: 'search', data: timeout});
    };

    this.terminate = function() {
      emitter.emit('terminate');
    };
  });
  
  console.log("trying to connect with",master);
  client.connect(master, function(remote, conn) {

    function reconnect() {
      console.log('Calling reconnect()');
      conn.reconnect(1000, function (err) {
        if (err) {
          console.error(err);
          reconnect();
        } else {
          console.warn('loopsiloppsiloo');
        }
      });
    }

    conn.on('ready', function () {
      console.log("Connected, waiting for jobs");
    });

    conn.on('timeout', function () {
      console.log('Timeout with the server.');
      reconnect();
    });

    conn.on('end', function () {
      console.log('Server probably crashed.');
      reconnect();
    });

    emitter.on('result', function(data) {
      remote.processResult(data);
    });

    emitter.on('terminate', function() {
      console.log('Force terminate of client');
      conn.end();
    });
  });

}

if (require.main === module) {
  for (var i=0;i<CLI_PROCESSES;i++) {
    exports.start({host: process.ARGV[2] || 'chessathome.no.de', port: process.ARGV[3] || 3000, reconnect: 100}, 'cli-' + i);
  }
}
//TODO stop ?

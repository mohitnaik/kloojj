/*var file = __dirname + '/../../config/workflow.json'
    ,mod = require('../../controller.js')
    ,cluster = require('cluster')
    ,zmq = require('zmq')
    ,rp = require('requestprocessor')
    ,fs = require('fs')
    ,bunyan = require('bunyan')
    ,Elasticsearch = require('bunyan-elasticsearch')
    ,option = {flags: 'r',encoding: 'utf8'}
    ,outrequesterFactory = {}
    ,config
    ,ip
    ,port
    ,workercount
    ,esStream
    ,logger
    ,wfobj;

var eventEmitter = mod.eventEmitter;
config = JSON.parse(fs.readFileSync(file));
ip = config.node.server;
port = config.node.port;
workercount = config.node.worker;

// configuring elastic search client
esStream = new Elasticsearch({
  indexPattern: config.elasticSearch.indexPattern,
  type: 'logs',
  host: config.elasticSearch.host
});
//setting up logger
logger = bunyan.createLogger({
  name: 'dal module',
  streams: [
      {stream: process.stdout},
      {stream: esStream}
           ],
  serializers: bunyan.stdSerializers
});

fs.watchFile(file, function() {
  config = JSON.parse(fs.readFileSync(file,option));
});

var requester = new rp('req',ip,port).socket;

function populatecalltype(wfobj) {
  return wfobj.hasOwnProperty('method') ? 'method' : (wfobj.hasOwnProperty('workflow') ? 'workflow' : 'NAN');
}

function populateentityname(wfobj) {
  return wfobj.hasOwnProperty('method') ? wfobj.method : (wfobj.hasOwnProperty('workflow') ?  wfobj.workflow : 'NAN');
}

function getDataFromObject(obj, prop) {

  if (typeof obj === 'undefined') {
    return false;
  }
  var _index = prop.indexOf('.');
  if (_index > -1) {
    return getDataFromObject(obj[prop.substring(0, _index)], prop.substr(_index + 1));
  }
  if (prop === '*') {
    return obj;
  } else {
    if (!obj.hasOwnProperty(prop)) {
      throw Error('Input parameter not found');
    }
    return obj[prop];
  }
}

function getOutRequester(addr) {
  if (outrequesterFactory.hasOwnProperty(addr)) {
    return outrequesterFactory[addr];
  } else {
    var outrequester = zmq.socket('req');
    outrequester.connect(addr);
    outrequesterFactory[addr] = outrequester;
    return outrequesterFactory[addr];
  }
}

function validateAndSetParameters(dataobj) {
  dataobj.payload = {};
  var parameter  = dataobj.currentobject.parameters;
  for (var i = 0; i < parameter.length; i++) {
    if (parameter[i].from.substring(0,5) === 'input') {
      try {
        if (parameter[i].name === '*') {
          dataobj.payload = getDataFromObject(dataobj.parameter,parameter[i].from.substring(6));
        } else {
          dataobj.payload[parameter[i].name] = getDataFromObject(dataobj.parameter,parameter[i].from.substring(6));
        }
      }
      catch (ex) {
        logger.error(ex,dataobj);
      }
    } else {
      try {
        if (parameter[i].name === '*') {
          dataobj.payload = getDataFromObject(dataobj.output,parameter[i].from);
        } else {
          dataobj.payload[parameter[i].name] = getDataFromObject(dataobj.output,parameter[i].from);
        }
      }
      catch (ex) {
        logger.error(ex,dataobj);
      }
    }
  }
  return dataobj;
}
function ReadandExecWorkflow(wflobj, dataobj) {

  if (wflobj instanceof Object) {
    for (var index in wflobj) {

      if (wflobj[index].hasOwnProperty('module') && wflobj[index].hasOwnProperty('server') && wflobj[index].hasOwnProperty('port')) {
        dataobj.calltype = populatecalltype(wflobj[index]);
        dataobj.entityName = populateentityname(wflobj[index]);
        dataobj.currentobject = wflobj[index];
        dataobj.calltype = (dataobj.calltype === 'method') ? 'directmethod' : dataobj.calltype;
        getOutRequester(wflobj[index].server + ':' + wflobj[index].port).send(JSON.stringify(dataobj));
      } else if (wflobj[index].hasOwnProperty('method')) {
        dataobj.calltype = populatecalltype(wflobj[index]);
        dataobj.entityName = populateentityname(wflobj[index]);
        dataobj.currentobject = wflobj[index];
        if (dataobj.currentobject.hasOwnProperty('parameters')) {
          dataobj = validateAndSetParameters(dataobj);
        } else {
          dataobj.payload = dataobj.parameter;
        }
        requester.send(JSON.stringify(dataobj));
      } else if (wflobj[index].hasOwnProperty('workflow')) {
        dataobj.calltype = populatecalltype(wflobj[index]);
        dataobj.entityName = populateentityname(wflobj[index]);
        dataobj.currentobject = wflobj[index];
        requester.send(JSON.stringify(dataobj));
      }
    }
  } else {
    logger.info('Not a valid workflow decleration');
  }
}

function wfcallback(data) {
  var wfobject = data.currentobject;
  if (wfobject !== null && wfobject instanceof Object) {
    ReadandExecWorkflow(wfobject,data);
  }
}

function getwfobject(obj, label) {
  for (var i in obj) {
    if (obj[i].hasOwnProperty('method')) {
      if (obj[i].method === label) { return obj[i]; }
      getwfobject(obj[i], label);
    }
  }
  return null;
}

function clone(obj) {
  if (null === obj || 'object' !== typeof obj) {return obj;}
  var copy = obj.constructor();
  for (var attr in obj) {
    if (obj.hasOwnProperty(attr)) {copy[attr] = obj[attr];}
  }
  return copy;
}

if (cluster.isMaster) {
  var
  // master process create ROUTER and DEALER sockets, bind endpoints
  router = zmq.socket('router').bind(ip + ':' + port),
  dealer = zmq.socket('dealer').bind('ipc://filer-dealer.ipc');
  // forward messages between router and dealer
  router.on('message', function() {
    var frames = Array.apply(null, arguments);
    dealer.send(frames);
  });
  dealer.on('message', function() {
    var frames = Array.apply(null, arguments);
    router.send(frames);
  });
  // listen for workers to come online
  cluster.on('online', function(worker) {
    console.log('Worker ' + worker.process.pid + ' is online.');
  });
  // fork three worker processes
  for (var i = 0; i < workercount; i++) {
    cluster.fork();
  }
} else {
  // worker process create REP socket, connect to DEALER
  var responder = zmq.socket('rep').connect('ipc://filer-dealer.ipc');
  responder.on('message', function(data) {
    data = JSON.parse(data);
    data.return = {};
    logger.info(data);
    switch (data.calltype) {
      case 'workflow'://external request to execute workflow
        wfobj = config[data.entityName];
        ReadandExecWorkflow(wfobj,data);
      break;
      case 'method'://internal request to execute method
        try {
          mod[data.entityName](data);
        }
        catch (ex) {
          logger.error(ex,data);
        }
      break;
      case 'directmethod'://external request to execute workflow
        wfobj = config['direct-methods'];
        var result = getwfobject(wfobj,data.entityName);
        if (result !== null) {
          mod[data.entityName](data.entityName,data,wfcallback);
        } else {
          logger.error('method you are trying to acess is private and not accessible',data);
        }
      break;
      case 'worasdaskflow'://external request to execute workflow
      break;

    }
    responder.send('ok');
  });
}

eventEmitter.on('methodComplete', function(data) {
  if (!data.hasOwnProperty('output')) {
    data.output =  {};
  }

  if (data.currentobject !== null && data.currentobject.hasOwnProperty('feedback') && data.currentobject.feedback === true) {
    var wrap = [];
    var newdata = clone(data);
    wrap.push(config.feedback);
    data.output[data.entityName] = data.return;
    newdata.previousMethod = data.entityName;
    ReadandExecWorkflow(wrap,newdata);
  }

  if (data.return.status === 'success') {
    wfcallback(data);
  }

});*/

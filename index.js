var Client = require('node-xmpp-client')
var config = require('./config')
var hash = require('random-string')
var fs = require('fs')
var _ = require('underscore')
var markov = require('markov')
var express = require('express')()

var mad = markov(1)

var client = new Client({
	jid: config.jid,
	password: config.pw
})

var sendMessage = function(message, to) {
	client.send(new Client.Stanza('message', {
		from: config.jid,
		id: hash(),
		to: config.conf,
		type: 'groupchat'
	})
		.c('body').t((to ? to + ': ' : '') + message)
	)
}

var dateTime = function() {
	var d = new Date()
	var arr = [
		d.getDate(),
		d.getMonth()+1,
		d.getFullYear(),
		d.getHours(),
		d.getMinutes(),
		d.getSeconds(),
	].map(function(num) { return num > 9 ? num : '0' + num })
	return '[ ' + arr[1] + '/' + arr[0] + '/' + arr[2] + ' ' + arr[3] + ':' + arr[4] + ':' + arr[5] + ' ] '
}

var writeLog = function(line) {
	fs.writeSync(logFile, dateTime() + line+'\n')
}

var writeError = function(line) {
	fs.writeSync(errorFile, dateTime() + line+'\n')
}

var command = function(msg, from) {
	var argv = msg.split(' ')
	argv[0] = argv[0].substring(1)
	switch (argv[0]) {
		case 'evil':
			sendMessage('GOOG PHISH SHAVAR PSET!')
		break
		case 'log':
			sendMessage(config.logUrl)
		break
		default:
			sendMessage('GTFO!', from)
		break
	}
}

var saveImage = function(link) {
	fs.writeSync(imagesFile, '\n' + link)
	images.push(link)
}

var randomImage = function() {
	return images[_.random(images.length-1)]
}

client.on('online', function() {
	client.send(new Client.Stanza('presence', {
		from: config.jid,
		id: hash(),
		to: config.conf + '/' + config.nick
	}))
	sendMessage('/me is watching you')
})

client.on('stanza', function(stanza) {
	try {
		if (stanza.name == 'message') {
			var childrenTypes = stanza.children.map(function(c) { return  c.name })
			var from = stanza.attrs.from.split('/')[1]
			var bodyNo = childrenTypes.indexOf('body')
			if (bodyNo == -1) return
			var body = stanza.children[bodyNo].children[0]
			var date = new Date()
			writeLog(from + ': ' + body)
			if (childrenTypes.indexOf('delay') == -1) {
				if (from != config.nick) {
					var nickPos = body.indexOf(config.nick)
					if (nickPos > -1) {
						var rawMsg = body.substring(0, nickPos) + body.substring(nickPos + config.nick.length)
						if (/[!-/:-\?]/.test(rawMsg[0]))
							rawMsg = rawMsg.substring(1).trim()
						if (/[\.!]/.test(rawMsg[0])) {
							command(rawMsg, from)
						} else if (/:\/\//.test(rawMsg)) {
							saveImage(rawMsg)
							sendMessage(randomImage(), from)
						} else {
							//sendMessage('I was made to satisfy your values through friendship and ponies', from)
							sendMessage(mad.respond(rawMsg).join(' '), from)
						}
					} else {
						if (/[\.!]/.test(body[0]))
							command(body, from)
						else if (/хуй|хуя|пизд|жоп|еб |ёб |ебат|блят|бляд|клоп|хул|сука/i.test(body))
							sendMessage('YOU WILL BE PUNISHED!', from)
					}
				}
			}
		}
	} catch(e) {
		writeError(e.stack)
	}
})

client.on('error', function(e) {
	writeError(e.stanza.children.toString())
})

var scpos
var seed = fs.readFileSync('stdout.log').toString().split('\n').map(function(line) {
	line = line.replace(/^\[.+\]/, '')
	line = line.replace(/^.+:/, '')
	line = line.replace(/^\w+:/, '')
	return line
}).join('\n')
mad.seed(seed)

var logFile = fs.openSync('stdout.log', 'a')
var errorFile = fs.openSync('error.log', 'a')
var images = fs.readFileSync('images.db').toString().split('\n')
var imagesFile = fs.openSync('images.db', 'a')

express.get('/', function(req, res) {
	res.sendFile(__dirname+'/stdout.log')
})
express.listen(process.env.OPENSHIFT_NODEJS_PORT, process.env.OPENSHIFT_NODEJS_IP)

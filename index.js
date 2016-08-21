'use strict';

var config = require('./config')

var fs = require('fs')

var Client = require('node-xmpp-client')

var hash = require('random-string')
var _ = require('underscore')
var markov = require('markov-respond')
var express = require('express')()

var fetch = require('fetch').fetchUrl
var parser = require('htmlparser')
var $ = require('soupselect').select
var unhtml = require('unescape-html')

var mad = new markov(1, 1)

var nicks = []

var client = new Client({
	jid: config.jid,
	password: config.pw
})

var preventNicksHighlight = function(msg, i) {
	i = (typeof i === 'number') ? i : 0
	var newMsg = nicks.reduce(function(newMsg, nick) {
		return newMsg.replace(/^(.)./, '$1' + (
			(nick.charAt(1) !== '-') ? '-' : '_'
		))
	}, msg)
	// limit of recursion
	if (msg !== newMsg && i <= 20) {
		return preventNicksHighlight(newMsg, ++i);
	} else {
		return newMsg;
	}
}

var sendMessage = function(message, to) {
	var fullMsg = ((to ? to + ': ' : '') + message)
	client.send(
		new Client.Stanza('message', {
			from: config.jid,
			id: hash(),
			to: config.conf,
			type: 'groupchat'
		}).c('body').t(preventNicksHighlight(fullMsg))
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

var trainMad = function(line) {
	mad.train(line.replace(/^\w+:/, '').split(' ').filter(function(word) {
		return !word.match(/\/\//)
	}).join(' '))
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

var fetchBashorg = function(body) {
	try {
		fetch(body.match(/https?:\/\/[a-z\.\/\?=]+\d+/)[0], function(err, meta, res) {
			if (err) { throw 'Bashorg: Invalid URL' }
			(new parser.Parser(new parser.DefaultHandler(function(err, dom) {
				if (err) { throw 'Bashorg: Bogus HTML' }
				sendMessage(($(dom, '.quote .text')[0] || $(dom, '.q div')[4]).children.reduce(function(msg, tag) {
					return msg + (tag.type == 'text' ? unhtml(tag.data) : '\n')
				}, ''))
			}))).parseComplete(res.toString())
		})
	} catch(e) {
		sendMessage('Pure, pure Bashorg!')
		throw e
	}
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
							var response, noInfLoop=5
							do
								response = mad.respond(rawMsg)
							while (!response.length && noInfLoop--)
							sendMessage(response, from)
						}
					} else {
						if (/[\.!]/.test(body[0]))
							command(body, from)
						else if (wordFilter.test(body))
							sendMessage('YOU WILL BE PUNISHED!', from)
						else if (/bash\.im|bezdna\.su/.test(body))
							fetchBashorg(body)
						else
							trainMad(body)
					}
				}
			}
		} else if (stanza.name == 'presence') {
			var nick = stanza.attrs.from.split('/')[1]
			var isOnline = stanza.attrs.type !== 'unavailable'
			var nickIdx = nicks.indexOf(nick)
			if (isOnline) {
				if (!~nickIdx) {
					nicks.push(nick)
				}
			} else {
				if (~nickIdx) {
					nicks.splice(nickIdx, 1)
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
fs.readFileSync('stdout.log').toString().split('\n').forEach(function(line) {
	line = line.replace(/^\[.+\] /, '')
	if (!line.indexOf(config.nick.split(/v\d/)[0]) || line.match(/^undefined/))
		return

	trainMad(line.replace(/^.+:/, ''))
})

var wordFilter = new RegExp(fs.readFileSync('wordFilter.txt').toString().trimRight().replace(/\n/g, '|'), 'i')

var logFile = fs.openSync('stdout.log', 'a')
var errorFile = fs.openSync('error.log', 'a')
var images = fs.readFileSync('images.db').toString().split('\n')
var imagesFile = fs.openSync('images.db', 'a')

express.get('/', function(req, res) {
	res.sendFile(__dirname+'/stdout.log')
})
express.listen(process.env.OPENSHIFT_NODEJS_PORT, process.env.OPENSHIFT_NODEJS_IP)

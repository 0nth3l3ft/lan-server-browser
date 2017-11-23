var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var striptags = require('striptags');
var glob = require('glob-fs')({ gitignore: true });
var fs = require('fs');
var path = require('path');

//load config
var config = require('./config.json');
config.port = config.port || 3000;
config.motd = config.motd || "welcome";

var port = process.env.PORT || config.port;

var users = {};
var channels = [];

//load all channels from config file
for(var i in config.channels) {
	channels.push({
		name: config.channels[i].name,
		type: 'permanent'
	});
}

const commands = {
	'/motd': {
		args: [],
		description: "Show the servers welcome message",
		handle: function(socket, io){
			return config.motd;
		}
	},
	'/help': {
		args: [],
		description: "Show this help",
		handle: function(socket, io){
			var help = "";

			for(var cmd in commands) {
				help += cmd + ' <i>' + commands[cmd].args.join('</i> <i>') + '</i> - '+commands[cmd].description+'<br>'
			}

			return help;
		}
	},
	'/color': {
		args: ['color'],
		description: "Set the users display color. In HEX form (e.g #ff0000 - red, #00ff00 - green)",
		handle: function(socket, io, args){
			if(args.color) {
				if(/#[a-f0-9]{6}/.test(args.color)) {

					users[socket.id] = users[socket.id] || {};
					users[socket.id].color = args.color;
					
					//update the client
					socket.emit('update_settings', users[socket.id]);

					return 'Set color to ' + args.color;
				} else {
					return 'Invalid color "' + args.color + '"';
				}
			}
		}
	},
	'/nickname': {
		args: ['nickname'],
		description: "Set the  users display name",
		handle: function(socket, io, args){
			if(args.nickname) {
				users[socket.id] = users[socket.id] || {};
				users[socket.id].nickname = args.nickname;

				//update the client
				socket.emit('update_settings', users[socket.id]);

				return 'Set nickname to ' + args.nickname;
			}
		}
	},
	'/avatar': {
		args: ['avatar'],
		description: "Set the avatar for the user",
		handle: function(socket, io, args){
			if(args.avatar) {
				users[socket.id] = users[socket.id] || {};
				users[socket.id].avatar = args.avatar;

				//update the client
				socket.emit('update_settings', users[socket.id]);

				return 'Set avatar to ' + args.avatar;
			}
		}
	},
	'/allusers': {
		args: [],
		description: "List all connected users",
		handle: function(socket, io, args){
			var msg = "<strong>Users:</strong><br>";

			for(var id in users) {
				msg += users[id].nickname + ' - ' + users[id].channel + '<br>';
			}

			return msg;
		}
	},
	'/users': {
		args: [],
		description: "List all users in current channel",
		handle: function(socket, io, args){
			var user = users[socket.id];
			var msg = "<strong>Users in channel "+user.channel +":</strong><br>";

			for(var id in users) {
				if(users[id].channel == user.channel) {
					msg += users[id].nickname + '<br>';
				}
			}

			return msg;
		}
	},
	'/channels': {
		args: [],
		description: "List all channels",
		handle: function(socket, io, args){
			var msg = "<strong>Channels:</strong><br>";

			for(var i in channels) {
				msg += channels[i].name + ' - <i>' + channels[i].type + '</i> - Join via <i>/join '+channels[i].name+'</i><br>';
			}

			msg += '<br>You are currently on channel ' + users[socket.id].channel;

			return msg;
		}
	},
	'/join': {
		args: ['channel'],
		description: "Join a channel",
		handle: function(socket, io, args){
			var valid = false;
			var ret;

			for(var i in channels) {
				if(channels[i].name == args.channel) {
					valid = true;
				}
			}

			if(valid) {
				users[socket.id].channel = args.channel;
				ret = 'Joined channel "' + args.channel + '"';
			} else {
				users[socket.id].channel = 'public';
				ret = 'Invalid channel "' + args.channel + '" joined "public"';
			}

			console.log(users[socket.id]);

			//send user joind message
			socket.broadcast.emit('message', {type: 'server', message: 'User </span> <span style="color: '+users[socket.id].color+'">&nbsp;' + users[socket.id].nickname + '&nbsp;</span> <span> joined ' + users[socket.id].channel});

			//update the client
			socket.emit('update_settings', users[socket.id]);
			return ret;
		}
	},
	'/create': {
		args: ['channel'],
		description: "Creates a temporary channel",
		handle: function(socket, io, args){
			var valid = true;

			for(var i in channels) {
				if(channels[i].name == args.channel) {
					valid = false;
				}
			}

			if(valid) {
				//create the channel
				channels.push({
					name: args.channel,
					type: 'temporary'
				});
				
				//update the client
				io.emit('update_channels', channels);
			}

			//join the new channel
			return commands['/join'].handle(socket, io, {channel: args.channel});
		}
	}
}


app.get('/api/users', function(req, res){
	res.send(users);
});

app.get('/api/channels', function(req, res){
	res.send(channels);
});

app.get('/api/servers', function(req, res){
	var json = JSON.parse(fs.readFileSync(config.server_file));
	res.send(json);
});

app.get('/icons.js', function(req, res){
	var js = "var icons = {";

	var files = glob.readdirSync('./public/icons/*.png');

	for(var i in files) {
		var name = path.basename(files[i], '.png');
		var cnt = fs.readFileSync(files[i]);
		js += '"' + name + '":"data:image/png;base64,' + new Buffer(cnt).toString('base64') + '",' + "\n";
	}

	js += "};";

	res.set('Content-Type', 'application/javascript');
	res.send(js);
});

app.use(express.static('public'));

io.on('connection', function(socket){

	socket.on('user_connect', function(data){
		console.log("User " + data.nickname + " connected");
		users[socket.id] = data || {};
		users[socket.id].nickname = users[socket.id].nickname || 'anon';
		users[socket.id].color = users[socket.id].color || '#ff0000';
		users[socket.id].channel = users[socket.id].channel || 'public';

		//rejoin channel (checks if channel valid)
		commands['/join'].handle(socket, io, {channel: users[socket.id].channel});

		//send motd message
		socket.emit('message',{type:'server', message: commands['/motd'].handle(socket, io)});
		socket.emit('message',{type:'server', message: commands['/channels'].handle(socket, io)});

		socket.emit('update_channels', channels);
	});

	socket.on('disconnect', function() {
		if(users[socket.id]) console.log("User " + users[socket.id].nickname + " disconnected");
		delete users[socket.id];
	});

	socket.on('message', function(msg){
		var user = users[socket.id];

		if(user) {
			console.log("Message [",user.nickname, "]", msg);
			msg = striptags(msg.trim());

			if(msg.length > 0) {

				//message that start with one '/' are commands
				if(msg[0] == '/' && msg[1] != '//') {
					var ret = null;

					//the all args & cmd name
					args = msg.split(' ');
					command = args.splice(0, 1);

					//check the command object
					for(var cmd in commands) {

						//if we have a command with this name
						if(cmd == command) {
							var values = {};

							//check if we have enought args
							commands[cmd].args = commands[cmd].args || [];
							if(args.length >= commands[cmd].args.length) {
								
								//get all arguments for this command
								for(var i in commands[cmd].args) {
									console.log(i, args);

									values[commands[cmd].args[i]] = args[i];
								}

								//call the command handler function
								ret = commands[cmd].handle.call(this, socket, io, values);
							}
						}
					}

					if(ret == null) {
						socket.emit('message', {type:'server', message: 'Invalid command "' + msg + '"'});
					} else {
						socket.emit('message',{type:'server', message: ret});
					}
				} else {
					msg = msg.replace('//','/');
					msg = msg.replace(/\[link ["']([^"']+)["'] ["']([^"']+)["']\]/g, '<a href="$1">$2</a>');
					msg = msg.replace(/\[link ["']([^"']+)["']\]/g, '<a href="$1">$1</a>');

					io.emit('message', {type:'user', channel: user.channel, user: user, message:msg});
				}
			}
		}
	});
});

http.listen(port, function(){
	console.log('listening on *:' + port);
});

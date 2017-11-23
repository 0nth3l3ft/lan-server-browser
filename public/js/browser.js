$(function () {
	//get channel list
	$.ajax({
		url: '/api/servers',
		success: function(data) {
			for(var i in data) {
				var server = data[i];

				var game = server.game;
				var gameType = (server.gametype || server.game_type);

				if(game == 'cstrike' || game == 'csgo') {
					game = gameType;

					gameType = null;
					gameType = gameType || (server.map.indexOf('de_') == 0 ? 'de' : null);
					gameType = gameType || (server.map.indexOf('cs_') == 0 ? 'cs' : null);
				}

				var row = $('<tr>');
				row.append($('<td>').text(game));
				row.append($('<td>').text(gameType));
				row.append($('<td>').text(server.server_name));
				row.append($('<td>').text(server.map));
				row.append($('<td>').text(server.players));
				row.append($('<td>').text(server.max_players));
				row.append($('<td>').html('<a href="steam://connect/' + server.ip + ':' + server.port + '">Join</a> <a href="#" onclick="chatSendMessage(\'Join me at [link \\\'steam://connect/' + server.ip + ':' + server.port + '\\\' \\\''+server.server_name+' - ' + server.ip + ':' + server.port + '\\\']\')" title="Send join link via chat"><span class="glyphicon glyphicon-link"></span></a>'));

				$('#browser table tbody').append(row);
			}

			$('#browser table').DataTable();
		}
	});
});
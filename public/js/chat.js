$(function () {
  var socket = io();
  var nickname = localStorage.getItem('user.nickname') || 'anon';
  var color = localStorage.getItem('user.color') || '#ff0000';
  var channel = localStorage.getItem('user.channel') || 'public';

  var history = JSON.parse(localStorage.getItem('history')) || [];
  var historyIndex = history.length;

  window.chatSendMessage = function(message) {
    socket.emit('message', message);
  }

  //update settings form
  $('#nickname').val(nickname);
  $('#color').val(color);
  $('#channel-selector button').html(channel + '<span class="caret"></span>');

  //settings form
  $('#nickname').change(function(){
    socket.emit('message', '/nickname ' + $(this).val());
  });

  $('#color').change(function(){
    socket.emit('message', '/color ' + $(this).val());
  });

  $('#channel-selector').on('click', 'li a', function(e){
    var channel = $(this).data('channel');
    socket.emit('message', '/join ' + channel);
    $('#channel-selector button').html(channel + '<span class="caret"></span>');
  });

  //get channel list
  $.ajax({
    url: '/api/channels',
    success: function(data) {
      for(var i in data) {
        $('#channel-selector ul').append('<li><a href="#" data-channel="'+data[i].name+'">' + data[i].name + '</a></li>');
      }
    }
  });

  //on socket connect send our user information
  socket.on('connect', function(){
    socket.emit('user_connect', {
      nickname: nickname,
      color: color,
      channel: channel
    });
  });

  //submit a message
  $('#chat form').submit(function(){
    var message = $('#m').val().trim();

    //save commands to history
    if(message.length > 2 && (message[0] == '/' && message[1] != '/')) {
      history.push(message);
      historyIndex = history.length;
      localStorage.setItem('history', JSON.stringify(history));
    }

    if(message == '/clear') {
      $('#messages').html('');
    } else{
      socket.emit('message', message);
    }

    $('#m').val('');
    return false;
  });

  $('#chat form input').keydown(function(e){
    var code = e.which || e.keycode;
    if(code == 38 || code == 40) {
      if(code == 38) {
        historyIndex--;
      } else if(code == 40) {
        historyIndex++;
      }

      if(historyIndex < 0) historyIndex = 0;
      if(historyIndex > history.length) historyIndex = history.length;
      
      if(history[historyIndex] !== undefined) {
        $('#chat form input').val(history[historyIndex]);
      } else {
        $('#chat form input').val('');
      }
    }
  });

  //a message is incomming
  socket.on('message', function(data){
    if(data.channel === undefined || data.channel == channel) {
      //replace aliases
      for(var from in icon_aliases) {
        data.message = data.message.replace(from, ':' + icon_aliases[from] + ':');
      }

      //parse icons
      data.message = data.message.replace(/:([a-z]+):/g, function(match, contents, offset, input_string) {
        return '</span><img src="'+icons[contents]+'"><span>';
      });

      var message = $('<li>')
        .addClass('type-' + data.type)
        .html('<span>' + data.message + '</span>');

      if(data.user) {
        var user = $('<span>').addClass('nickname').css('color', data.user.color).text(data.user.nickname);
        message.prepend(user);
      }

      $('#messages').append(message);
      $('#messages').scrollTop($('#messages')[0].scrollHeight);
    }
  });

  //update client settings
  socket.on('update_settings', function(data){
    for(var i in data) {
      localStorage.setItem('user.' + i, data[i]);
    }

    nickname = localStorage.getItem('user.nickname') || 'anon';
    color = localStorage.getItem('user.color') || '#ff0000';
    channel = localStorage.getItem('user.channel') || 'public';

    //update settings form
    $('#nickname').val(nickname);
    $('#color').val(color);
    $('#channel-selector button').html(channel + '<span class="caret"></span>');
  });

  //update client settings
  socket.on('update_channels', function(data){
    $('#channel-selector ul').html('');
    for(var i in data) {
      $('#channel-selector ul').append('<li><a href="#" data-channel="'+data[i].name+'">' + data[i].name + '</a></li>');
    }
  });
});

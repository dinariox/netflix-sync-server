// ---------------------------------- //
// --- IMPORTS ---------------------- //
// ---------------------------------- //
const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const ShortUniqueId = require('short-unique-id');

// ---------------------------------- //
// --- VARIABLES -------------------- //
// ---------------------------------- //
const PORT = 8700;
const app = express();
const server = http.createServer(app);
const io = new socketio.Server(server, {
	cors: {
		origin: '*',
		methods: ['GET', 'POST']
	}
});
const getUID = new ShortUniqueId({ length: 10 });

const defaultUsernamePrefixes = ['Awesome', 'Cool', 'Great', 'Super', 'Interesting', 'Funny', 'Curious', 'Fantastic', 'Wholesome', 'Silly', 'Lame', 'Smart', 'Smartest', 'Pretty'];

const defaultUsernameSuffixes = [
	'Giraffe',
	'Panda',
	'Lion',
	'Tiger',
	'Bear',
	'Monkey',
	'Elephant',
	'Gorilla',
	'Hippo',
	'Whale',
	'Shark',
	'Dolphin',
	'Penguin',
	'Pig',
	'Cow',
	'Chicken',
	'Dog',
	'Cat',
	'Horse',
	'Puppy',
	'Kitten'
];

let users = {};

// ---------------------------------- //
// --- FUNCTIONS -------------------- //
// ---------------------------------- //
function _log(msg) {
	const now = new Date();
	console.log(`[${now.toLocaleString()}] ${msg}`);
}

function getCurrentRoom(socket) {
	return Array.from(socket.rooms)[1];
}

function emitUserList(room) {
	let usersInRoom = io.sockets.adapter.rooms.get(room);
	let usernames = [];
	if (!usersInRoom) return;
	usersInRoom.forEach((socketId) => {
		usernames.push(users[socketId].name || 'Anonymous');
	});
	io.to(room).emit('user-list', usernames);
}

function getRandomUsername() {
	let username = '';
	do {
		let prefix = defaultUsernamePrefixes[Math.floor(Math.random() * defaultUsernamePrefixes.length)];
		let suffix = defaultUsernameSuffixes[Math.floor(Math.random() * defaultUsernameSuffixes.length)];
		username = `${prefix} ${suffix}`;
	} while (
		Object.values(users)
			.map((user) => user.name)
			.includes(username)
	);
	return username;
}

// ---------------------------------- //
// --- MAIN ------------------------- //
// ---------------------------------- /
io.on('connection', (socket) => {
	_log(`New socket.io connection (${socket.id})`);

	users[socket.id] = {
		id: socket.id,
		name: getRandomUsername()
	};

	socket.on('disconnecting', () => {
		let currRoom = getCurrentRoom(socket);
		if (currRoom) {
			socket.leave(currRoom);
			emitUserList(currRoom);
		}
	});

	socket.on('disconnect', () => {
		_log(`Socket.io connection (${socket.id}) disconnected`);
		delete users[socket.id];
	});

	socket.on('change-username', (name, callback) => {
		_log(`Socket.io connection (${socket.id}) set username to ${name}`);
		users[socket.id].name = name;
		let currRoom = getCurrentRoom(socket);
		if (currRoom) {
			emitUserList(currRoom);
		}
		callback({
			error: null
		});
	});

	socket.on('get-username', (callback) => {
		callback({
			error: null,
			username: users[socket.id].name
		});
	});

	socket.on('create-room', (callback) => {
		const currRoom = getCurrentRoom(socket);
		if (currRoom) {
			socket.leave(currRoom);
			emitUserList(currRoom);
		}
		const newRoomID = getUID().toUpperCase();
		socket.join(newRoomID);
		emitUserList(newRoomID);
		_log(`Socket.io connection (${socket.id}) created room ${newRoomID}`);
		callback({
			error: null,
			roomID: newRoomID
		});
	});

	socket.on('join-room', (room, callback) => {
		// test if room exists
		if (io.sockets.adapter.rooms.get(room)) {
			const currRoom = getCurrentRoom(socket);
			if (currRoom) {
				socket.leave(currRoom);
				emitUserList(currRoom);
			}
			socket.join(room);
			emitUserList(room);
			_log(`Socket.io connection (${socket.id}) joined room ${room}`);
			callback({
				error: null,
				roomID: room
			});
		} else {
			_log(`Socket.io connection (${socket.id}) failed to join room ${room}`);
			callback({
				error: 'Room does not exist',
				roomID: null
			});
		}
	});

	socket.on('leave-room', (callback) => {
		const currRoom = getCurrentRoom(socket);
		if (currRoom) {
			socket.leave(currRoom);
			emitUserList(currRoom);
			_log(`Socket.io connection (${socket.id}) left room ${currRoom}`);
			callback({
				error: null
			});
		} else {
			_log(`Socket.io connection (${socket.id}) failed to leave room`);
			callback({
				error: 'No room to leave'
			});
		}
	});

	socket.on('get-current-room', (callback) => {
		callback(Array.from(socket.rooms)[1]);
	});
});

server.listen(PORT, () => {
	_log(`Server running on port ${PORT}`);
});
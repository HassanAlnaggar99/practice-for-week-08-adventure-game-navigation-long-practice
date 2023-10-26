const http = require('http');
const fs = require('fs');

const { Player } = require('./game/class/player');
const { World } = require('./game/class/world');

const worldData = require('./game/data/basic-world-data');
const { dir } = require('console');

let player;
let world = new World();
world.loadWorld(worldData);

const server = http.createServer((req, res) => {
  console.log(`${req.method} ${req.url}`);
  /* ============== ASSEMBLE THE REQUEST BODY AS A STRING =============== */
  let reqBody = '';
  req.on('data', (data) => {
    reqBody += data;
  });

  req.on('end', () => { // After the assembly of the request body is finished
    /* ==================== PARSE THE REQUEST BODY ====================== */
    if (reqBody) {
      req.body = reqBody
        .split("&")
        .map((keyValuePair) => keyValuePair.split("="))
        .map(([key, value]) => [key, value.replace(/\+/g, " ")])
        .map(([key, value]) => [key, decodeURIComponent(value)])
        .reduce((acc, [key, value]) => {
          acc[key] = value;
          return acc;
        }, {});
    }

    /* ======================== ROUTE HANDLERS ========================== */
    function redirectCurrentRoom() {
      let currentRoom = player.currentRoom;
      let currentRoomId = currentRoom.id;

      res.statusCode = 302;
      res.setHeader('Location', `/rooms/${currentRoomId}`);
      return res.end();
    }

    // Phase 1: GET /
    if (req.method === 'GET' && req.url === '/') {
      const htmlTemplate = fs.readFileSync('./views/new-player.html', 'utf-8');
      const htmlPage = htmlTemplate
      .replace(/#{availableRooms}/g, world.availableRoomsToString());

      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html');
      res.write(htmlPage);
      return res.end();
    }

    // Phase 2: POST /player
    if (req.method === 'POST' && req.url === '/player') {
      let { name, roomId} = req.body;
      let room = world.rooms[roomId];
      player = new Player(name, room);

      res.statusCode = 302;
      res.setHeader('Location', `/rooms/${roomId}`);
      return res.end();
    }

    if (!player) {
      res.statusCode = 302;
      res.setHeader('Location', '/');
      return res.end();
    }

    // Phase 3: GET /rooms/:roomId
    if (req.method === 'GET' && /\/rooms\/[0-9]+$/.test(req.url)) {
      const urlParts = req.url.split('/');
      const roomId = Number(urlParts[2]);
      const room = world.rooms[roomId];
      if(room === player.currentRoom) {

        const htmlTemplate = fs.readFileSync('./views/room.html', 'utf-8');
        const htmlPage = htmlTemplate
        .replace(/#{roomName}/g, room.name)
        .replace(/#{inventory}/g, player.inventoryToString())
        .replace(/#{roomItems}/g, room.itemsToString())
        .replace(/#{exits}/g, room.exitsToString());

        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html');
        return res.end(htmlPage);

      } else {
        return redirectCurrentRoom();
      }
    }

    // Phase 4: GET /rooms/:roomId/:direction
    if (req.method === 'GET' && /\/rooms\/[0-9]+\/[a-z]+$/.test(req.url)) {
      const urlParts = req.url.split('/');
      const currentRoomId = Number(urlParts[2]);
      const currentRoom = world.rooms[currentRoomId];
      const direction = urlParts[3][0];

      if(currentRoom === player.currentRoom) {
        let destination = currentRoom.exits[direction];

        if (destination) {
          let destinationId = destination.id;
          player.move(direction);

          res.statusCode = 302;
          res.setHeader('Location', `/rooms/${destinationId}`);
          return res.end();
        } else {
          return redirectCurrentRoom();
        }
      } else {
        return redirectCurrentRoom();
      }
    }

    // Phase 5: POST /items/:itemId/:action
    if (req.method === 'POST' && /\/items\/[0-9]+\/[a-z]+$/.test(req.url)) {
      const urlParts = req.url.split('/');
      const itemId = Number(urlParts[2]);
      const action = urlParts[3];

      // make sure that the item is in the same room as the player
      // make sure that the action is compatible with the item

      try {
        switch(action) {
          case 'drop':
            player.dropItem(itemId);
            break;
          case 'eat':
            player.eatItem(itemId);
            break;
          case'take':
            player.takeItem(itemId);
            break;
        }
      } catch (e) {
        console.log(`Error: ${e.message}`);
        const htmlTemplate = fs.readFileSync('./views/error.html', 'utf-8');
        const htmlPage = htmlTemplate
        .replace(/#{errorMessage}/g, `${e.message}`)
        .replace(/#{roomId}/g, `${player.currentRoom.id}`);

        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html');
        return res.end(htmlPage);
      }
      console.log('Out of error');
      return redirectCurrentRoom();
    }

    // Phase 6: Redirect if no matching route handlers
    redirectCurrentRoom();
  })
});

const port = 5000;

server.listen(port, () => console.log('Server is listening on port', port));

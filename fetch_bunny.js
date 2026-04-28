const https = require('https');

const options = {
  hostname: 'video.bunnycdn.com',
  path: '/library/588852/videos?page=1&itemsPerPage=5&orderBy=date',
  method: 'GET',
  headers: {
    'AccessKey': 'f98d3cb7-2a9a-4ce5-b3f4d76c2e45-67e8-410c',
    'accept': 'application/json'
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      console.log(JSON.stringify(parsed.items.map(i => ({ title: i.title, guid: i.guid, date: i.dateUploaded })), null, 2));
    } catch(e) {
      console.log(data);
    }
  });
});

req.on('error', (e) => {
  console.error(e);
});
req.end();

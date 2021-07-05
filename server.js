require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const dns = require('dns');
const mongoose = require('mongoose');
const AutoIncrement = require('mongoose-sequence')(mongoose);
const nodeUrl = require('url');

// Basic Configuration
const port = process.env.PORT || 3000;

// DB
mongoose.connect(process.env.DB_URI, {useNewUrlParser: true, useUnifiedTopology: true, useFindAndModify: false})
  .then(() => {
    console.log("Database connected");
  }).catch(error => {
    console.error("Connection error: ", error)
  });

const db = mongoose.connection;

const urlShortSchema = new mongoose.Schema({
  original_url: String,
  short_url: Number
});

urlShortSchema.plugin(AutoIncrement, {id:'short_url_seq', inc_field: 'short_url'});

const UrlShort = mongoose.model('UrlShort', urlShortSchema);

app.use(cors());
app.use(express.json())
app.use(express.urlencoded({extended: false}))
app.use('/public', express.static(`${process.cwd()}/public`));

app.get('/', function(req, res) {
  res.sendFile(process.cwd() + '/views/index.html');
});


const checkExistUrlInDB = (url) => {
  return new Promise((resolve, reject) => {
    UrlShort.findOne({original_url: url}, (err, data) => {
      if(err) reject(err);
      if(data == null) return resolve({ status: false });

      resolve({ status: true, original_url: data.original_url, short_url: data.short_url });
    })
  });
}

const checkShortUrl = (short_url) => {
  return new Promise((resolve, reject) => {
    UrlShort.findOne({ short_url }, (err, data) => {
      if(err || data == null) return resolve(false);
      resolve({ original_url: data.original_url });
    })
  })
}

const isDnsActive = (url) => {
  return new Promise((resolve, reject) => {
    dns.lookup(nodeUrl.parse(url).hostname, (err, addresses, family) => {
        if(err) reject(false);
        resolve(url);
    });

  })
}

// Your first API endpoint
app.get('/api/hello', function (req, res) {
  res.json({
    greeting: 'hello API'
  });
});


/*
POST /api/shorturl
  return { original_url : 'https://freeCodeCamp.org', short_url : 1}
  
  If URL is invalid
    return { error: 'invalid url' }
*/
app.post('/api/shorturl', async function(req, res) {
  const { url } = req.body;
  const pattern = /^(http:\/\/www\.|https:\/\/www\.|http:\/\/|https:\/\/)?[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}(:[0-9]{1,5})?(\/.*)?$/
  const checkValidUrl = new RegExp(pattern, 'gi');

  try {

    if(!checkValidUrl.test(url)) {
      throw Error();
    }

    const checkDnsActive = await isDnsActive(url);
    if(!checkDnsActive) {
      throw Error();
    }
  
    const isExistUrl = await checkExistUrlInDB(url);

    if(isExistUrl.status) {
      return res.json({ original_url: isExistUrl.original_url, short_url: isExistUrl.short_url });  
    }

    const urlConstructDoc = new UrlShort({ original_url: checkDnsActive });
    urlConstructDoc.save((err, data) => {
      if (err) throw Error();
      return res.json({ original_url: url, short_url: data.short_url });
    });

  } catch(err) {
    return res.json({ error: 'invalid url' });
  }
})

/*
GET /api/shorturl/<short_url>
  redirect <short_url>
*/

app.get('/api/shorturl/:number', async function (req, res) {
  const { number } = req.params;
  const checkShortUrlInDB = await checkShortUrl(parseInt(number));
  
  if(!checkShortUrlInDB) {
    return res.json({ error: "invalid url" });
  }
  
  res.redirect(checkShortUrlInDB.original_url);
});

app.listen(port, function() {
  console.log(`Listening on port ${port}`);
});
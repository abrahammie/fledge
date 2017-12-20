const expressSession = require('express-session');
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;
const db = require('../db/index.js');
const helpers = require('../db/helpers.js');
var googleAuth = require('google-auth-library');
var google = require('googleapis');
var oauth2Client;
var fs = require('fs');

const app = express();

require('dotenv').config();


app.set('port', process.env.PORT || 2000);
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '/../dist/')));
app.use(bodyParser.json());
app.use(
  expressSession({
    secret: 'shhhh',
    resave: true,
    saveUninitialized: true,
  })
);
app.use(passport.initialize());
app.use(passport.expressSession());


//Set up google login protocol
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.LOCAL_GOOGLE_REDIRECT,
  passReqToCallback: true
  },
  //lookup or create a new user using the googleId (no associated username or password)
  function(req, accessToken, refreshToken, profile, done) {
    db.findOrCreateUser({ googleId: profile.id, sessionID: req.sessionID }, function (err, user) {
      return done(err, user);
    });
  }
));
passport.serializeUser(function(user, done) {
  done(null, user._id);
});
passport.deserializeUser(function(_id, done) {
  db.User.findById(_id, function(err, user) {
    done(err, user);
  });
});

app.use(passport.initialize());
//set up the route to Google for authentication
app.get('/auth/google', passport.authenticate('google', {
  scope: [
      'https://www.googleapis.com/auth/plus.login',
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/calendar',
      ]
}));
//set up the return handler after Google has authenticated
app.get('/auth/google/callback', passport.authenticate('google', {failureRedirect: '/' }), function(req, res) {
    res.redirect('/');
});

app.post('/api/applications', (req, res) => {
  var userId = req.user.googleId;

    // if request is for edit
  if (req.body.edited !== undefined) {
    console.log('edit application post request');
    helpers.updateApp(userId, req.body.edited, (err, updatedUser) => {
      if (err) {
        console.log('Error updating: ', err);
      } else {
        res.send(JSON.stringify({ applications: updatedUser.apps }));
      }
    });

  // if request is for adding new
  } else if (req.body.newApplication !== undefined) {
    console.log('add application post request');
    helpers.saveApp(userId, req.body.newApplication, (err, user) => {
      if (err) {
        console.log('Error saving new:', err);
      } else {
        res.send(JSON.stringify({ applications: user.apps }));
      }
    });
  }
});

app.get('/api/applications', (req, res) => {
  // get applications for specific user
  helpers.getApplications(req.user.googleId, (err, apps) => {
    if (err) {
      console.log(err);
    } else {
      res.send(JSON.stringify({ applications: apps }));
    }
  });
});

app.get('/api/reminders', (req, res) => {
  console.log('getting reminders')
  // get reminders for specific user
  helpers.getReminders(req.user.googleId, (err, reminders) => {
    console.log(reminders)
    if (err) {
      console.log(err);
    } else {
      res.send(JSON.stringify(reminders));
    }
  });
});

app.get('/logged', (req, res) => {
  if (req.isAuthenticated()) {
    res.send(req.isAuthenticated());
    res.sendStatus(200);
  } else {
    res.send(req.isAuthenticated());
    res.sendStatus(401);
  }
});

app.get('/logout', (req, res) => {
  req.expressSession.destroy((err) => {
    if (err) {
      console.log('error on logout: ', err);
    }
    res.send();
  });
});

app.get('/', (req, res) => {
  res.sendFile(__dirname + '../dist/index.html');
});

app.post('/api/reminders', (req, res) => {

  console.log('setting google calendar reminder', req.body)
  let userId = req.user.googleId;
  helpers.saveReminder(userId, req.body.addReminder, (err) => {
      if (err) {
        console.log('Error saving reminder:', err);
      } else {
        console.log('Reminder Saved')
      }
    });

  let startDate = req.body.addReminder.start.split('').slice(0, 10).join('');



  let event = {
    'summary': req.body.addReminder.summary,
    'description': 'https://murmuring-mesa-56363.herokuapp.com/',
    'start': {
      'dateTime': startDate + 'T06:00:00-08:00',
    },
    'end': {
      'dateTime': startDate + 'T08:00:00-08:00',
    },
    'reminders': {
      'useDefault': false,
      'overrides': [
        {'method': 'email', 'minutes': 1},
        {'method': 'popup', 'minutes': 1},
      ],
    },
};

  let calendar = google.calendar('v3');

  calendar.events.insert({
    auth: oauth2Client,
    calendarId: 'primary',
    resource: event,
  }, function(err, event) {
    if (err) {
      console.log('There was an error contacting the Calendar service: ' + err);
      return;
    }
    console.log('Event created: %s', event.htmlLink);
  });

  helpers.getApplications(req.user.googleId, (err, apps) => {
    if (err) {
      console.log(err);
    } else {
      res.send(JSON.stringify({ applications: apps }));
    }
  });


});


app.listen(app.get('port'), () =>
  console.log('app running on port', app.get('port'))
);


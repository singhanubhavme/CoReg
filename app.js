const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const https = require("https");
const app = express();
let nodemailer = require('nodemailer');
app.set('view engine', 'ejs');
let request = require('request');
let JSONStream = require('JSONStream');
let es = require('event-stream');
require('dotenv').config();
const mongoose = require('mongoose');
mongoose.connect(process.env.DB_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useFindAndModify: false
});

const userSchema = new mongoose.Schema({
  secret: String,
  fname: String,
  email: String,
  pincode: String
});

const secretSchema = new mongoose.Schema({
  secret: String
});

const User = new mongoose.model("User", userSchema);
const Secret = new mongoose.model("Secret", secretSchema);

app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(express.static("public"));

app.get("/", function (req, res) {
  res.render("index");
})
app.get("/about", function (req, res) {
  res.render("about");
})

function dataparser(jsonData, i) {
  let dist = jsonData[i].district_name;
  let pinc = jsonData[i].pincode;
  let centrname = jsonData[i].name;
  let centraddr = jsonData[i].address;
  let vaccine = jsonData[i].vaccine;
  let doseone = jsonData[i].available_capacity_dose1;
  let dosetwo = jsonData[i].available_capacity_dose2;
  let feetype = jsonData[i].fee_type;
  let minage = jsonData[i].min_age_limit;
  let toemail = "<br>District = " + dist + "<br>Pincode = " + pinc + "<br>Center Name = " + centrname + "<br>Centre Address = " + centraddr + "<br>Vaccine Name = " + vaccine + "<br>Fee Type = " + feetype + "<br>Minimum Age = " + minage + "<br>Dose 1 = " + doseone + "<br>Dose 2 = " + dosetwo + "<br><br>";
  return {
    toemail,
    doseone,
    dosetwo,
    feetype
  };
}




app.get("/run", function (req, res) {
  User.find(function (err, data) {
    User.countDocuments({}, function (err, c) {
      for (let i = 0; i < c; i++) {
        let pin = data[i].pincode;
        let emailadd = data[i].email;
        let datetime = new Date();
        let datevar = datetime.getDate() + "-" + ((parseInt(datetime.getMonth())) + parseInt("1")) + "-" + datetime.getFullYear();
        let url = "https://cdn-api.co-vin.in/api/v2/appointment/sessions/public/findByPin?pincode=" + pin + "&date=" + datevar;

        request({
            url: url
          })
          .pipe(JSONStream.parse('*'))
          .pipe(es.mapSync(function (jsonData) {
            let arrlen = jsonData.length;
            let parseddata = [];

            if (arrlen != 0) {
              for (let i = 0; i < arrlen; i++) {
                parseddata[i] = dataparser(jsonData, i);
              }
              let senddata = []
              for (let x = 0; x < arrlen; x++) {
                if ((parseddata[x].doseone >= 2 || parseddata[x].dosetwo >= 2)) {
                  // if ((parseddata[x].doseone >= 2 || parseddata[x].dosetwo >= 2) && parseddata[x].feetype === 'Free') {
                  senddata.push(parseddata[x].toemail);

                }
              }

              for (let y = 0; y < arrlen; y++) {
                if ((parseddata[y].doseone >= 2 || parseddata[y].dosetwo >= 2)) {
                  // if ((parseddata[y].doseone >= 2 || parseddata[y].dosetwo >= 2) && parseddata[y].feetype === 'Free') {
                  funmail(JSON.stringify(senddata), emailadd);
                  break;
                }
              }

            }
            return jsonData;
          }))

      }
    })
  })
  res.render("success");
})

function funmail(toemail, emailadd) {
  let transporter = nodemailer.createTransport({
    service: 'gmail',
    host: 'smtp.gmail.com',
    auth: {
      user: "covidvaccinefinder.live@gmail.com",
      pass: process.env.EMAIL_PASS,

    },
  });

  let mailOptions = {
    from: "covidvaccinefinder.live@gmail.com",
    to: emailadd,
    subject: 'Covid Vaccine Update',
    html: toemail
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log(error);
    }
  });
}



app.get("/delete", (req, res) => {
  res.render("delete");
})


app.post("/delete", (req, res) => {
  const email = req.body.email;
  const pincode = req.body.pincode;
  User.find((err, data) => {
    User.countDocuments({}, (err, c) => {
      for (var i = 0; i < c; i++) {
        if ((data[i].email == email) && (data[i].pincode == pincode)) {
          User.findOneAndDelete({
            email: email
          }, (err, docs) => {
            if (err) {
              return res.render("error");
            }
          })
        }
      }
    })
  })
  res.render("success");
})

app.get("/signup", (req, res) => {
  res.render("signup");
})
app.post("/", (req, res) => {
  res.render("index");
})

app.post("/signup", (req, res) => {
  const name = req.body.fname;
  const email = req.body.email;
  const pincode = req.body.pincode;
  const ipsecret = req.body.secret;
  let check = 0;
  Secret.find((err, data) => {
    Secret.countDocuments({}, (err, c) => {
      for (let i = 0; i < c; i++) {
        if (data[i].secret == ipsecret) {
          check = check + 1;
          const newUser = new User({
            secret: ipsecret,
            fname: name,
            email: email,
            pincode: pincode
          })
          newUser.save((err) => {
            if (err) {
              res.render("error");
            }
          })
          Secret.findOneAndDelete({
            secret: ipsecret
          }, (err, docs) => {
            if (err) {
              res.render("error");
            } else {
              res.render("success");
            }
          })
        }
      }
      if (check == 0) {
        res.render("error");
      }
    })
  })
})

app.listen(3000, () => {
  console.log("Server started on port 3000");
});
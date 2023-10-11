const express = require('express');
const axios = require('axios');
const bodyparser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config()
const conn = require('./database/mysql');
const fetchuser = require('./fetchuser');
// const { parse } = require('dotenv');

require('dotenv').config()

const app = express();

app.use(bodyparser.json());
app.use(express.json());

app.use(cors(
  {
    origin: ["http://localhost:3000", "https://urlofthefrontendappafterdeployment.com"],
    methods: ["GET", "POST", "DELETE", "PUT", "OPTIONS"],
    credentials: true
  }
));

////////////////
//Add new User//
///////////////
app.post("/api/newuser", (req, res) => {
  const sql = "INSERT INTO users (username, password) VALUES (?, ?)";
  const { username, password } = req.body;
  bcrypt.genSalt(10, (err, salt) => {
    if (err) {
      return res.json({ success: false, error: err });
    };
    bcrypt.hash(password, salt, (err, hash) => {
      if (err) {
        return res.json({ success: false, error: err });
      };
      try {
        conn.query(sql, [username, hash], (err, result) => {
          if (err) {
            return res.json({ success: false, error: err });
          };
          if (result.affectedRows) {
            return res.json({ success: true, data: "", message: `${username} registered successfully` });
          } else {
            return res.json({ success: false, error: `${username} could not be registered` });
          };
        });
      } catch (err) {
        return res.json({ success: false, error: err });
      };
    });
  });
});

//////////////
//User Login//
/////////////
app.post("/api/login", (req, res) => {
  const sql = "SELECT * FROM users where username = ?";
  const { username, password } = req.body;
  try {
    conn.query(sql, [username], (err, result) => {
      if (err) {
        return res.json({ success: false, error: err });
      };
      if (result.length === 0) {
        return res.json({ success: false, error: "Invalid username or password" });
      };
      bcrypt.compare(password, result[0].password, (err, validUser) => {
        if (err) {
          return res.json({ success: false, error: err });
        };
        if (validUser) {
          const username = result[0].username;
          const token = jwt.sign({ loggedinUser: username }, process.env.SECRET_KEY);
          return res.json({
            success: true,
            data: {
              userid: result[0].id,
              user: result[0].username,
              token: token
            },
            message: `${username} logged in successfully`
          });
        } else {
          return res.json({ success: false, error: "Invalid username or password" });
        };
      });
    });
  } catch (err) {
    return res.json({ success: false, error: err });
  };
});

///////////////////////////////////
//List of Companies Search Select//
///////////////////////////////////
app.get("/api/home/forselect", (req, res) => {
  const sql = "SELECT id as value, company as label FROM companies";
  try {
    conn.query(sql, (err, result) => {
      if (err) {
        return res.json({ success: false, error: err });
      };
      if (result.length === 0) {
        return res.json({ success: false, error: "No companies available" })
      }
      return res.json({ success: true, data: result });
    });
  } catch (err) {
    return res.json({ success: false, error: err });
  };
});

//////////////////
//Portfolio Data//
//////////////////
app.get("/api/home/portfolio", fetchuser, async (req, res) => {
  let sql = "SELECT * FROM users WHERE username = ?";
  try {
    conn.query(sql, [req.username], (err, result) => {
      if (err) {
        return res.json({ success: false, error: err });
      };
      if (result.length === 0) {
        return res.json({ success: false, error: "User not found" });
      };
      const userid = result[0].id;
      sql = "SELECT c.symbol	, c.company, CAST(sum(p.buyqty) AS FLOAT) AS buyqty, CAST(sum(p.buyrate*p.buyqty)/sum(p.buyqty) AS FLOAT) AS buyavgrate, CAST(sum(p.buyrate*p.buyqty) AS FLOAT) AS buyamount, CAST(ifnull(sum(s.saleqty),0) AS FLOAT) AS saleqty, CAST(ifnull(sum(s.salerate*s.saleqty)/sum(s.saleqty),0) AS FLOAT) AS saleavgrate, CAST(ifnull(sum(s.salerate*s.saleqty),0) AS FLOAT) AS saleamount, CAST(ifnull((sum(s.salerate*s.saleqty)/sum(s.saleqty)-sum(p.buyrate*p.buyqty)/sum(p.buyqty))*sum(s.saleqty),0) AS FLOAT) AS realisedprofit, CAST(sum(p.buyqty)-ifnull(sum(s.saleqty),0) AS FLOAT) AS qtyinhand, CAST(sum(p.currentRate) AS FLOAT) AS currentrate, CAST(sum(p.currentvalue) AS FLOAT) as currentvalue FROM purchases p LEFT JOIN companies c ON c.id = p.companyid LEFT JOIN sales s ON s.buyid = p.id WHERE p.userid = ? GROUP BY p.companyid";
      try {
        conn.query(sql, [userid], (err, result) => {
          if (err) {
            return res.json({ success: false, error: err });
          };
          return res.json({ success: true, data: result });
        });
      } catch (err) {
        return res.json({ success: false, error: "User not found" });
      };
    });
  } catch (err) {
    return res.json({ success: true, error: err });
  }
});

//////////////
//Buy Shares//
//////////////
app.post("/api/home/buy", fetchuser, async (req, res) => {
  let sql = "SELECT * FROM users WHERE username = ?";
  const { shareid, buydate, buyqty, buyrate } = req.body;
  try {
    conn.query(sql, [req.username], (err, result) => {
      if (err) {
        return res.json({ success: false, error: err });
      };
      if (result.length === 0) {
        return res.json({ success: false, error: "User not found" });
      };
      const userid = result[0].id;
      sql = "INSERT INTO purchases (companyid, buydate, buyqty, buyrate, userid) VALUES (?, ?, ?, ?, ?)";
      try {
        conn.query(sql, [shareid, buydate, buyqty, buyrate, userid], (err, result) => {
          if (err) {
            return res.json({ success: false, error: err });
          };
          if (result.affectedRows) {
            return res.json({
              success: true,
              newRecord: {
                id: result.insertId,
                shareid: shareid,
                buydate: buydate,
                buyqty: buyqty,
                buyrate: buyrate,
                userid: userid
              },
              message: "Record saves successfully"
            });
          } else {
            return res.json({ success: false, error: "Record not saved" });
          };
        });
      } catch (err) {
        return res.json({ success: false, error: err });
      };
    });
  } catch (err) {
    return res.json({ success: false, error: err });
  };
});

////////////////////
//Purchase History//
////////////////////
app.post("/api/home/listforsale", fetchuser, async (req, res) => {
  const { symbol } = req.body;
  let sql = "SELECT * FROM users WHERE username = ?";
  try {
    conn.query(sql, [req.username], (err, result) => {
      if (err) {
        return res.json({ success: false, error: err });
      };
      if (result.length === 0) {
        return res.json({ success: false, error: "User not found" });
      };
      const userid = result[0].id;
      console.log(userid);
      sql = "SELECT p.id, c.symbol, c.company, p.buyqty, CAST((p.buyqty-ifnull(s.saleqty,0)) AS FLOAT) AS qtyinhand , p.buyrate FROM purchases p LEFT JOIN companies c ON c.id = p.companyid LEFT JOIN sales s ON s.buyid = p.id WHERE p.userid = ? AND c.symbol = ? AND (p.buyqty-ifnull(s.saleqty,0)) > 0";
      try {
        conn.query(sql, [userid, symbol], (err, result) => {
          if (err) {
            return res.json({ success: false, error: err });
          };
          return res.json({ success: true, data: result });
        });

      } catch (err) {
        return res.json({ success: true, error: err });
      };
    });
  } catch (err) {
    return res.json({ success: true, error: err });
  };
});

////////////////////////////
//Delete a Purchased Share//
////////////////////////////
app.delete("/api/home/deletebuy/:id", fetchuser, async (req, res) => {
  const id = req.params.id;
  let sql = "SELECT * FROM users WHERE username = ?";
  try {
    conn.query(sql, [req.username], (err, result) => {
      if (err) {
        return res.json({ success: false, error: err });
      };
      if (result.length === 0) {
        return res.json({ success: false, error: "User not found" });
      };
      const userid = result[0].id;
      sql = "DELETE FROM purchases where userid = ? and id = ?";
      try{
        conn.query(sql, [userid, id], (err, result) => {
          if(err){
            return res.json({success:false, error:err});
          };
          if(result.affectedRows){
            return res.json({success:true, messgae:"Record deleted successfully"});
          } else {
            return res.json({success:false, error:"Record Not found"});
          }
        });
        } catch(err) {
        return res.json({ success: false, error: err });
      };
    });
  } catch (err) {
    return res.json({ success: true, error: err });
  };
});


const port = process.env.PORT || 5000;

app.listen(port, () => {
  console.log(port);
});
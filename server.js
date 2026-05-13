const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const cors = require("cors");
require("dotenv").config();

const app = express();


// ================= MIDDLEWARE =================

app.use(express.json());

app.use(cors());

app.use(express.static("public"));


// ================= MONGODB CONNECTION =================

mongoose.connect(process.env.MONGO_URI)

    .then(() => console.log("MongoDB Connected"))

    .catch(err => console.log(err));




// ================= USER SCHEMA =================

const userSchema = new mongoose.Schema({

    name: String,

    username: {

        type: String,

        unique: true
    },

    password: String
});

const User = mongoose.model("User", userSchema);




// ================= NOTES SCHEMA =================

const noteSchema = new mongoose.Schema({

    username: String,

    text: String,

    x: {

        type: Number,

        default: 100
    },

    y: {

        type: Number,

        default: 120
    },

    completed: {

        type: Boolean,

        default: false
    },

    createdAt: {

        type: Date,

        default: Date.now
    }
});

const Note = mongoose.model("Note", noteSchema);




// ================= SHARE TASK SCHEMA =================

const shareSchema = new mongoose.Schema({

    fromUser: String,

    toUser: String,

    text: String,

    status: {

        type: String,

        default: "pending"
    }
});

const Share = mongoose.model("Share", shareSchema);




// ================= SIGNUP =================

app.post("/signup", async (req, res) => {

    try {

        const { name, username, password } = req.body;

        const existingUser = await User.findOne({ username });

        if (existingUser) {

            return res.status(400).json({

                message: "Username already exists"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({

            name,

            username,

            password: hashedPassword
        });

        await newUser.save();

        res.json({

            success: true,

            message: "Signup successful"
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({

            message: "Server Error"
        });
    }
});




// ================= LOGIN =================

app.post("/login", async (req, res) => {

    try {

        const { username, password } = req.body;

        const user = await User.findOne({ username });

        if (!user) {

            return res.status(400).json({

                message: "User not found"
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {

            return res.status(400).json({

                message: "Invalid password"
            });
        }

        res.json({

            success: true,

            message: "Login successful",

            user: {

                name: user.name,

                username: user.username
            }
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({

            message: "Server Error"
        });
    }
});




// ================= ADD NOTE =================

app.post("/add-note", async (req, res) => {

    try {

        const { username, text } = req.body;

        const randomX = Math.floor(Math.random() * 900) + 50;

        const randomY = Math.floor(Math.random() * 500) + 120;

        const newNote = new Note({

            username,

            text,

            x: randomX,

            y: randomY
        });

        await newNote.save();

        res.json({

            success: true,

            message: "Task Added"
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({

            message: "Server Error"
        });
    }
});




// ================= GET ACTIVE NOTES =================

app.get("/get-notes/:username", async (req, res) => {

    try {

        const notes = await Note.find({

            username: req.params.username,

            completed: false

        }).sort({ createdAt: -1 });

        res.json(notes);

    } catch (error) {

        console.log(error);

        res.status(500).json({

            message: "Server Error"
        });
    }
});




// ================= GET COMPLETED NOTES =================

app.get("/completed-notes/:username", async (req, res) => {

    try {

        const notes = await Note.find({

            username: req.params.username,

            completed: true

        }).sort({ createdAt: -1 });

        res.json(notes);

    } catch (error) {

        console.log(error);

        res.status(500).json({

            message: "Server Error"
        });
    }
});




// ================= MOVE NOTE =================

app.put("/move-note/:id", async (req, res) => {

    try {

        const { x, y } = req.body;

        await Note.findByIdAndUpdate(req.params.id, {

            x,
            y
        });

        res.json({

            success: true
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({

            message: "Server Error"
        });
    }
});




// ================= COMPLETE NOTE =================

app.put("/complete-note/:id", async (req, res) => {

    try {

        await Note.findByIdAndUpdate(req.params.id, {

            completed: true
        });

        res.json({

            success: true
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({

            message: "Server Error"
        });
    }
});




// ================= DELETE NOTE =================

app.delete("/delete-note/:id", async (req, res) => {

    try {

        await Note.findByIdAndDelete(req.params.id);

        res.json({

            success: true,

            message: "Task Deleted"
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({

            message: "Server Error"
        });
    }
});




// ================= SHARE TASK =================

app.post("/share-note", async (req, res) => {

    try {

        const { fromUser, toUser, text } = req.body;

        const userExists = await User.findOne({

            username: toUser
        });

        if (!userExists) {

            return res.status(400).json({

                message: "Receiver username not found"
            });
        }

        const newShare = new Share({

            fromUser,

            toUser,

            text
        });

        await newShare.save();

        res.json({

            success: true,

            message: "Task Shared Successfully"
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({

            message: "Server Error"
        });
    }
});




// ================= GET SHARED TASKS =================

app.get("/shared-tasks/:username", async (req, res) => {

    try {

        const tasks = await Share.find({

            toUser: req.params.username,

            status: "pending"
        });

        res.json(tasks);

    } catch (error) {

        console.log(error);

        res.status(500).json({

            message: "Server Error"
        });
    }
});




// ================= ACCEPT SHARED TASK =================

app.post("/accept-task/:id", async (req, res) => {

    try {

        const shareTask = await Share.findById(req.params.id);

        if (!shareTask) {

            return res.status(404).json({

                message: "Task not found"
            });
        }

        const randomX = Math.floor(Math.random() * 900) + 50;

        const randomY = Math.floor(Math.random() * 500) + 120;

        const newNote = new Note({

            username: shareTask.toUser,

            text: shareTask.text,

            x: randomX,

            y: randomY
        });

        await newNote.save();

        shareTask.status = "accepted";

        await shareTask.save();

        res.json({

            success: true
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({

            message: "Server Error"
        });
    }
});




// ================= START SERVER =================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {

    console.log(`Server running on port ${PORT}`);
});
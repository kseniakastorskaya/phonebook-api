const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const { MongoClient, ObjectId } = require("mongodb");

const CONTACTS_COLLECTION = "contacts";
const app = express();

// ---- middleware (регистрируются всегда, до всего) ----
app.use(bodyParser.json());
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});
app.use(express.static(__dirname));

// ---- глобальные переменные для базы ----
let contacts = null;

// ---- маршруты (регистрируем сразу, не ждём базы) ----
function handleError(res, reason, message, code) {
  console.error("Ошибка:", reason);
  res.status(code || 500).json({ error: message });
}

// Заглушка для /api/* пока база не подключена
app.use("/api", (req, res, next) => {
  if (!contacts) {
    return res.status(503).json({ error: "База данных ещё не подключена. Подождите..." });
  }
  next();
});

app.get("/api/contacts", async (req, res) => {
  try {
    const list = await contacts.find({}).toArray();
    res.status(200).json(list);
  } catch (e) {
    handleError(res, e.message, "Не удалось получить контакты.");
  }
});

app.post("/api/contacts", async (req, res) => {
  const newContact = req.body;
  if (!newContact || !newContact.username) {
    return handleError(res, "Некорректный запрос", "Не указано имя контакта.", 400);
  }
  newContact.createDate = new Date();
  try {
    const result = await contacts.insertOne(newContact);
    res.status(201).json({ ...newContact, _id: result.insertedId });
  } catch (e) {
    handleError(res, e.message, "Не удалось создать контакт.");
  }
});

app.get("/api/contacts/:id", async (req, res) => {
  try {
    const doc = await contacts.findOne({ _id: new ObjectId(req.params.id) });
    if (!doc) return handleError(res, "Not found", "Контакт не найден.", 404);
    res.status(200).json(doc);
  } catch (e) {
    handleError(res, e.message, "Не удалось получить контакт.");
  }
});

app.put("/api/contacts/:id", async (req, res) => {
  const updateDoc = { ...req.body };
  delete updateDoc._id;
  try {
    const result = await contacts.findOneAndUpdate(
      { _id: new ObjectId(req.params.id) },
      { $set: updateDoc },
      { returnDocument: "after" }
    );
    if (!result) return handleError(res, "Not found", "Контакт не найден.", 404);
    res.status(200).json(result);
  } catch (e) {
    handleError(res, e.message, "Не удалось обновить контакт.");
  }
});

app.delete("/api/contacts/:id", async (req, res) => {
  try {
    const result = await contacts.deleteOne({ _id: new ObjectId(req.params.id) });
    if (result.deletedCount === 0) {
      return handleError(res, "Not found", "Контакт не найден.", 404);
    }
    res.status(200).json({ deleted: true });
  } catch (e) {
    handleError(res, e.message, "Не удалось удалить контакт.");
  }
});

// Явный маршрут на всякий случай
app.get("/client.html", (req, res) => {
  res.sendFile(path.join(__dirname, "client.html"));
});

// ---- подключение к MongoDB ----
const MONGO_URL = process.env.MONGODB_URI
  || "mongodb+srv://ksyni153_db_user:QnqU4Uek0TiXt9ti@cluster0.ft5k3mc.mongodb.net/phonebook?retryWrites=true&w=majority";
const PORT = process.env.PORT || 8080;

(async () => {
  try {
    const client = await MongoClient.connect(MONGO_URL);
    const db = client.db();
    contacts = db.collection(CONTACTS_COLLECTION);
    console.log("База данных подключена");

    // ---- стартуем сервер ТОЛЬКО после подключения ----
    app.listen(PORT, () => {
      console.log(`Приложение запущено на порту ${PORT}`);
    });
  } catch (err) {
    console.error("Ошибка подключения к MongoDB:", err);
    process.exit(1);
  }
})();
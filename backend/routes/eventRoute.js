const express = require("express")
const router = express.Router()
const eventController = require("../controller/events")
const isAuthorized = require("../middleware/authentication")
const permitted = require("../middleware/permission")
const { body } = require("express-validator")

router.post("/events/createevent", [
    body("objects").isLength({ min: 1 }),
    body("loanPurpose").trim().isLength({ min: 3 }),
    body("loanName").trim().isLength({ min: 3 }),
    body("contactPerson").trim().isLength({ min: 3 }),
    body("contactEmail").isEmail(),
    body("loanStart").trim().isDate(),
    body("loanEnd").trim().isDate()
], isAuthorized, eventController.createEvent)

router.get("/events/getevents", isAuthorized, permitted("admin", "reviewer", "approver"), eventController.getEvents)
router.get("/events/eventtasks", isAuthorized, permitted("admin", "reviewer", "approver"), eventController.getEventTasks)
router.post("/events/updateworkflow", [
    body("workflow").isLength({ min: 3 }),
    body("comment").isLength({ min: 3 }),
    body("id").isLength({ min: 5 })
], isAuthorized, permitted("admin", "reviewer", "approver"), eventController.updateWorkflow)

module.exports = router
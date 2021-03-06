const Event = require("../models/eventSchema")
const jwt = require("jsonwebtoken")
const loanObject = require("../models/objectSchema")
const { validationResult } = require("express-validator")



exports.createEvent = ((req, res, next) => {

    const objects = req.body.objects
    const loanPurpose = req.body.loanPurpose
    const loanName = req.body.loanName
    const contactPerson = req.body.contactPerson
    const contactEmail = req.body.contactEmail
    const loanStartDate = new Date(req.body.loanStart)
    const loanEndDate = new Date(req.body.loanEnd)
    const activeWorkflow = "Submitted"
    const workflowState = { status: "Submitted", owner: req.email, comment: "Submitted a workflow" }



    const historyObject = {
        loanName: loanName,
        email: contactEmail,
        loanStartDate: loanStartDate,
        loanEndDate: loanEndDate,
        workflowState: workflowState,
        activeWorkflow: activeWorkflow,
        eventID: null,
    }


    const validationErrors = validationResult(req)

    if (!validationErrors.isEmpty()) {
        console.log(validationErrors)
        const error = new Error("Loan purpose contains invalid data")
        error.statusCode = 422
        throw error;
    }

    if (loanStartDate > loanEndDate) {
        const error = new Error("End date can't be before start date")
        error.statusCode = 422
        throw error;
    }




    async function getObjects() {
        let dbResponse = ""
        let dbArr = []
        for (let object of objects) {
            dbResponse = await loanObject.findById(object._id).catch(err => console.log(err));
            dbArr.push(dbResponse)

        }
        return dbArr
    }

    getObjects()
        .then((returnedVal) => {

            let errorObject = {
                isError: false,
                objectName: null
            }
            for (let object of returnedVal) {
                for (let item of object.loanHistory) {

                    if ((item.loanStartDate >= loanStartDate && item.loanStartDate <= loanEndDate && item.loanEndDate >= loanEndDate) ||
                        (item.loanStartDate <= loanStartDate && item.loanEndDate >= loanEndDate) ||
                        (item.loanEndDate >= loanStartDate && item.loanEndDate <= loanEndDate && item.loanStartDate <= loanStartDate) ||
                        (item.loanStartDate >= loanStartDate && item.loanEndDate <= loanEndDate)) {
                        errorObject.isError = true;
                        errorObject.objectName = object.serialNumber

                        return errorObject

                    }


                }

            }

            return errorObject
        })
        .then((validationObject) => {
            if (validationObject.isError) {
                let error = new Error(`Object with serialno ${validationObject.objectName} already in use at this date`)
                error.statusCode = 400
                next(error)
            } else {


                const newEvent = new Event({
                    objects: objects,
                    loanPurpose: loanPurpose,
                    loanName: loanName,
                    contactPerson: contactPerson,
                    contactEmail: contactEmail,
                    loanStartDate: loanStartDate,
                    loanEndDate: loanEndDate,
                    activeWorkflow: activeWorkflow,
                    workflowState: workflowState
                })
                newEvent.save()
                    .then((res) => {
                            historyObject.eventID = res._id

                            for (object of objects) {
                                loanObject.findById(object._id)
                                    .then((foundObject) => {
                                        foundObject.loanHistory.push(historyObject)
                                        foundObject.save()
                                            .catch(() => {
                                                const error = new Error("Failed to insert data into loan object")
                                                error.statusCode(400)
                                                throw error
                                            })
                                    })
                                    .catch(err => {
                                        console.log(err)

                                    })
                            }

                        }




                    )
                    .then(res.status(200).json({ message: `Loan event ${loanName} created` }))
                    .catch((err) => console.log(err))



            }
        })




    .catch((err) => console.log(err))

})


exports.getEvents = ((req, res, next) => {


    let QueryParams = {}

    console.log(req.query)

    if ("loanStartDate" in req.query && req.query.loanStartDate != "") {
        QueryParams["loanStartDate"] = { $gte: new Date(req.query.loanStartDate) }
    }

    if ("loanEndDate" in req.query && req.query.loanEndDate != "") {
        QueryParams["loanEndDate"] = { $lte: new Date(req.query.loanEndDate) }
    }

    if ("loanPurpose" in req.query && req.query.loanPurpose != "") {
        QueryParams["loanPurpose"] = req.query.loanPurpose
    }

    if ("loanName" in req.query && req.query.loanName != "") {
        QueryParams["loanName"] = { $regex: req.query.loanName, $options: "i" }

    }

    if ("loanStatus" in req.query && req.query.loanStatus != "") {
        QueryParams["workflowState.status"] = req.query.loanStatus

    }






    Event.find(QueryParams)
        .then((foundEvents) => {
            res.status(200).json({
                message: "Success",
                events: foundEvents
            })
        })
        .catch((err) => {
            let error = new Error("Error while fetching events")
            error.statusCode = 400
            next(error)
            console.log(err)
        })
})

exports.getEventTasks = ((req, res, next) => {
    const role = req.role
    let query = {}

    if (role === "approver") {
        query["activeWorkflow"] = "Reviewed"
    } else if (role === "reviewer") {
        query["activeWorkflow"] = "Submitted"
    } else if (role === "admin") {
        query["activeWorkflow"] = { $ne: null }
    }


    Event.find(query)
        .then((eventTasks) => {
            res.status(200).json({
                message: "success",
                eventTasks: eventTasks
            })
        })
        .catch((err) => {
            console.log(err)
            const error = new Error("Failed to fetch Event Tasks")
            error.statusCode = 500;
            next(error);
        })

})

exports.updateWorkflow = ((req, res, next) => {

    const validationErrors = validationResult(req)
    if (!validationErrors.isEmpty()) {
        const error = new Error("Request contains invalid or missing data")
        error.statusCode = 400
        throw error
    }

    const id = req.body.id
    const workflow = req.body.workflow
    const comment = req.body.comment
    const email = req.email

    let payload = {
        status: workflow,
        owner: email,
        comment: comment
    }

    Event.findById(id)
        .then((foundEvent) => {
            foundEvent.workflowState.push(payload)
            foundEvent.activeWorkflow = workflow

            foundEvent.save()
                .then(() => {
                    res.status(200).json({
                        message: "Workflow successfully updated"
                    })
                })

        })
        .catch((err) => {
            console.log(err)
            const error = new Error("Event-ID does not exist")
            error.statusCode = 500
            next(error)
        })

})
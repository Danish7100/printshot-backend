const { v4: uuidv4 } = require('uuid');

let queuesCollection;
let printersCollection;

async function getCollections(db) {
  if (queuesCollection && printersCollection) {
    return { queuesCollection, printersCollection };
  }
  queuesCollection = db.collection('queues');
  printersCollection = db.collection('printers');
  return { queuesCollection, printersCollection };
}

async function getRealIds(db, fakePiId, fakePrinterId) {
  const { printersCollection } = await getCollections(db);
  const printerDoc = await printersCollection.findOne({ fakePiId, fakePrinterId });
  if (printerDoc) {
    return { piId: printerDoc.piId, printerId: printerDoc.printerName };
  }
  return null;
}

async function removeUserFromAllQueues(db, userId) {
  const { queuesCollection } = await getCollections(db);
  
  const queuesWithUser = await queuesCollection.find({ "queue.userId": userId }).toArray();

  for (const queueDoc of queuesWithUser) {
    const userIsActive = queueDoc.queue[0]?.userId === userId;
    let updatedQueue = queueDoc.queue.filter(u => u.userId !== userId);

    if (userIsActive && updatedQueue.length > 0) {
      updatedQueue[0].status = 'active';
      updatedQueue[0].locked_at = new Date().toISOString();
    }
    
    await queuesCollection.updateOne(
      { _id: queueDoc._id },
      { $set: { queue: updatedQueue } }
    );
  }
}

async function getQueue(db, fakePiId, fakePrinterId) {
  try {
    if (!db) {
      console.error('Database not connected');
      return [];
    }
    
    const realIds = await getRealIds(db, fakePiId, fakePrinterId);
    if (!realIds) {
      console.log('No real IDs found for:', { fakePiId, fakePrinterId });
      return [];
    }
    
    const { queuesCollection } = await getCollections(db);
    const queueDoc = await queuesCollection.findOne({ piId: realIds.piId, printerId: realIds.printerId });
    console.log('Queue document found:', queueDoc);
    return queueDoc?.queue || [];
  } catch (error) {
    console.error('Error in getQueue:', error);
    return [];
  }
}

async function acquireLock(db, fakePiId, fakePrinterId, userId) {
  await removeUserFromAllQueues(db, userId);

  const realIds = await getRealIds(db, fakePiId, fakePrinterId);
  if (!realIds) {
    throw new Error("Printer not found with the provided IDs.");
  }

  const { piId, printerId } = realIds;
  const { queuesCollection } = await getCollections(db);
  const queueDoc = await queuesCollection.findOne({ piId, printerId });

  const newUserEntry = {
    userId,
    joinedAt: new Date(),
    status: 'waiting',
    locked_at: null,
  };

  if (queueDoc) {
    const hasActiveUser = queueDoc.queue.some(u => u.status === 'active');

    if (!hasActiveUser) {
      newUserEntry.status = 'active';
      newUserEntry.locked_at = new Date().toISOString();
      await queuesCollection.updateOne(
        { _id: queueDoc._id },
        { $push: { queue: { $each: [newUserEntry], $position: 0 } } }
      );
      return true;
    } else {
      await queuesCollection.updateOne(
        { _id: queueDoc._id },
        { $push: { queue: newUserEntry } }
      );
      return false;
    }
  } else {
    newUserEntry.status = 'active';
    newUserEntry.locked_at = new Date().toISOString();
    await queuesCollection.insertOne({
      piId,
      printerId,
      queue: [newUserEntry],
    });
    return true; 
  }
}

async function releaseLock(db, fakePiId, fakePrinterId, userId) {
  const realIds = await getRealIds(db, fakePiId, fakePrinterId);
  if (!realIds) return false;

  const { piId, printerId } = realIds;
  const { queuesCollection } = await getCollections(db);
  
  const queueDoc = await queuesCollection.findOne({ piId, printerId });

  if (!queueDoc || queueDoc.queue.length === 0) {
    return false;
  }
  
  const userIndex = queueDoc.queue.findIndex(u => u.userId === userId);

  if (userIndex === -1) {
    return false;
  }

  const userWasActive = userIndex === 0;
  const updatedQueue = queueDoc.queue.filter(u => u.userId !== userId);

  if (userWasActive && updatedQueue.length > 0) {
    updatedQueue[0].status = 'active';
    updatedQueue[0].locked_at = new Date().toISOString();
  }

  const updateResult = await queuesCollection.updateOne(
    { _id: queueDoc._id },
    { $set: { queue: updatedQueue } }
  );

  return updateResult.modifiedCount > 0;
}

module.exports = {
  getQueue,
  acquireLock,
  releaseLock
};
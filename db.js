const fs = require('node:fs');
const path = require('node:path');

const dbFilePath = path.join(__dirname, 'database/users.json');

/**
 * Reads the entire users database from the JSON file.
 * @returns {object} The parsed user data object.
 */
function readUsers() {
    try {
        const data = fs.readFileSync(dbFilePath, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading or parsing database file:', error);
        // In a real-world scenario, you might want to handle this more gracefully,
        // maybe by returning an empty object or creating a backup.
        return {};
    }
}

/**
 * Writes the entire users database object to the JSON file.
 * @param {object} data The user data object to write.
 */
function writeUsers(data) {
    try {
        fs.writeFileSync(dbFilePath, JSON.stringify(data, null, 4));
    } catch (error) {
        console.error('Error writing to database file:', error);
    }
}

/**
 * Retrieves a single user's data from the database.
 * @param {string} userId The Discord ID of the user to retrieve.
 * @returns {object | undefined} The user's data object, or undefined if not found.
 */
function getUser(userId) {
    const users = readUsers();
    return users[userId];
}

/**
 * Updates a single user's data and saves it to the database.
 * This performs a full read-modify-write cycle.
 * @param {string} userId The Discord ID of the user to update.
 * @param {object} newData An object containing the new data to merge with existing data.
 * @returns {object} The updated user object.
 */
function updateUser(userId, newData) {
    const users = readUsers();
    if (users[userId]) {
        users[userId] = { ...users[userId], ...newData };
        writeUsers(users);
        return users[userId];
    }
    // If user doesn't exist, you might want to handle that,
    // but for this bot's flow, they should always exist for updates.
    return undefined;
}

/**
 * Creates a new user in the database.
 * @param {string} userId The Discord ID of the new user.
 * @param {object} userData The initial data for the new user.
 */
function createUser(userId, userData) {
    const users = readUsers();
    if (users[userId]) {
        // User already exists, perhaps log this or handle it as an error
        return;
    }
    users[userId] = userData;
    writeUsers(users);
}


module.exports = {
    readUsers,
    writeUsers,
    getUser,
    updateUser,
    createUser,
};

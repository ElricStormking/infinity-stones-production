/**
 * Authentication Module Index
 * 
 * Exports all authentication utilities and services
 */

const JWTAuth = require('./jwt');
const SessionManager = require('./sessionManager');

module.exports = {
    JWTAuth,
    SessionManager
};
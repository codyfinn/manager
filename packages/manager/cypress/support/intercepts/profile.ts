/**
 * @file Cypress intercepts and mocks for Cloud Manager profile and account requests.
 */

import { makeErrorResponse } from 'support/util/errors';
import type {
  Profile,
  SecurityQuestionsData,
  SecurityQuestionsPayload,
} from '@linode/api-v4/types';

/**
 * Intercepts GET request to fetch account user information.
 *
 * @param username - Username of user whose info is being fetched.
 *
 * @returns Cypress chainable.
 */
export const interceptGetUser = (username: string): Cypress.Chainable<null> => {
  return cy.intercept('GET', `*/account/users/${username}`);
};

/**
 * Intercepts GET request to fetch user profile.
 *
 * @returns Cypress chainable.
 */
export const interceptGetProfile = (): Cypress.Chainable<null> => {
  return cy.intercept('GET', '*/profile');
};

/**
 * Intercepts GET request to fetch user profile and mocks response.
 *
 * @param profile - Profile with which to respond.
 *
 * @returns Cypress chainable.
 */
export const mockGetProfile = (profile: Profile): Cypress.Chainable<null> => {
  return cy.intercept('GET', '*/profile', profile);
};

/**
 * Intercepts POST request to opt out of SMS verification and mocks response.
 *
 * @returns Cypress chainable.
 */
export const mockSmsVerificationOptOut = (): Cypress.Chainable<null> => {
  return cy.intercept('DELETE', '*/profile/phone-number', {});
};

/**
 * Intercepts POST request to send SMS verification code and mocks response.
 *
 * @returns Cypress chainable.
 */
export const mockSendVerificationCode = (): Cypress.Chainable<null> => {
  return cy.intercept('POST', '*/profile/phone-number', {});
};

/**
 * Intercepts POST request to verify SMS verification code and mocks response.
 *
 * If an `errorMessage` is provided, the mocked response will indicate an error.
 * Otherwise, a successful response is mocked.
 *
 * @param errorMessage - If specified, mocks an error response with the given message.
 *
 * @returns Cypress chainable.
 */
export const mockVerifyVerificationCode = (
  errorMessage?: string | undefined
): Cypress.Chainable<null> => {
  const response = !!errorMessage ? makeErrorResponse(errorMessage) : {};
  return cy.intercept('POST', '*/profile/phone-number/verify', response);
};

/**
 * Intercepts GET request to fetch security question data and mocks response.
 *
 * @param securityQuestionsData - Security questions response data.
 *
 * @returns Cypress chainable.
 */
export const mockGetSecurityQuestions = (
  securityQuestionsData: SecurityQuestionsData
): Cypress.Chainable<null> => {
  return cy.intercept(
    'GET',
    '*/profile/security-questions',
    securityQuestionsData
  );
};

/**
 * Intercepts POST request to update security questions and mocks response.
 *
 * @param securityQuestionsPayload - Security questions response data.
 *
 * @returns Cypress chainable.
 */
export const mockUpdateSecurityQuestions = (
  securityQuestionsPayload: SecurityQuestionsPayload
): Cypress.Chainable<null> => {
  return cy.intercept(
    'POST',
    '*/profile/security-questions',
    securityQuestionsPayload
  );
};

/**
 * Intercepts POST request to enable 2FA and mocks the response.
 *
 * @param secretString - Secret 2FA key to include in mocked response.
 *
 * @returns Cypress chainable.
 */
export const mockEnableTwoFactorAuth = (
  secretString: string
): Cypress.Chainable<null> => {
  // TODO Create an expiration date based on the current time.
  const expiry = '2025-05-01T03:59:59';
  return cy.intercept('POST', '*/profile/tfa-enable', {
    secret: secretString,
    expiry,
  });
};

/**
 * Intercepts POST request to disable two factor authentication and mocks response.
 *
 * @returns Cypress chainable.
 */
export const mockDisableTwoFactorAuth = (): Cypress.Chainable<null> => {
  return cy.intercept('POST', '*/profile/tfa-disable', {});
};

/**
 * Intercepts POST request to confirm two factor authentication and mocks response.
 *
 * @param scratchCode - Mocked 2FA scratch code.
 *
 * @returns Cypress chainable.
 */
export const mockConfirmTwoFactorAuth = (
  scratchCode: string
): Cypress.Chainable<null> => {
  return cy.intercept('POST', '*/profile/tfa-enable-confirm', {
    scratch: scratchCode,
  });
};

/**
 * Intercepts PUT request to update account username and mocks response.
 *
 * @param oldUsername - The original username which will be changed.
 * @param newUsername - The new username for the account.
 * @param restricted - Whether or not the account is restricted.
 *
 * @returns Cypress chainable.
 */
export const mockUpdateUsername = (
  oldUsername: string,
  newUsername: string,
  restricted: boolean = false
) => {
  return cy.intercept('PUT', `*/account/users/${oldUsername}`, {
    username: newUsername,
    email: 'mockEmail@example.com',
    restricted,
    ssh_keys: [],
    tfa_enabled: false,
    verified_phone_number: null,
  });
};

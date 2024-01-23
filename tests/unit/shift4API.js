const assert = require('assert');
const SitePreferences = require('*/cartridge/scripts/shift4/preferences');
const Shift4API = require('*/cartridge/scripts/shift4/services/shift4API');

beforeEach(() => {
    SitePreferences.custom.shift4payments__applePayVerificationString = 'applePayVerificationString';
    SitePreferences.custom.shift4payments__captureImmediately = true;
    SitePreferences.custom.shift4payments__environment = 'Test';
    SitePreferences.custom.shift4payments__livePublicKey = 'pk_live_1234567890';
    SitePreferences.custom.shift4payments__liveSecretKey = 'sk_live_1234567890';
    SitePreferences.custom.shift4payments__testPublicKey = 'pk_test_1234567890';
    SitePreferences.custom.shift4payments__testSecretKey = 'sk_test_1234567890';
    SitePreferences.commit();
});

describe('Shift4 API', () => {
    describe('Authentication', () => {
        // TEST MODE PUBLIC KEY
        it('Should pass when a valid test public key is provided', () => {
            Shift4API.verifyPublicKey(false);
            assert(true, 'Callout failed');
        });
        it('Should fail when invalid test public key is provided', () => {
            SitePreferences.custom.shift4payments__testPublicKey = 'invalid';
            SitePreferences.commit();
            try {
                Shift4API.verifyPublicKey(false);
                assert(false, 'Callout should have failed');
            } catch (e) {
                assert(true, 'Callout should have failed');
            }
        });

        // LIVE MODE PUBLIC KEY
        it('Should pass when a valid live public key is provided', () => {
            Shift4API.verifyPublicKey(true);
            assert(true, 'Callout failed');
        });
        it('Should fail when invalid live public key is provided', () => {
            SitePreferences.custom.shift4payments__livePublicKey = 'invalid';
            SitePreferences.commit();
            try {
                Shift4API.verifyPublicKey(true);
                assert(false, 'Callout should have failed');
            } catch (e) {
                assert(true, 'Callout should have failed');
            }
        });

        // TEST MODE SECRET KEY
        it('Should pass when a valid test secret key is provided', () => {
            Shift4API.verifySecretKey(false);
            assert(true, 'Callout failed');
        });
        it('Should fail when invalid test secret key is provided', () => {
            SitePreferences.custom.shift4payments__testSecretKey = 'invalid';
            SitePreferences.commit();
            try {
                Shift4API.verifySecretKey(false);
                assert(false, 'Callout should have failed');
            } catch (e) {
                assert(true, 'Callout should have failed');
            }
        });

        // LIVE MODE SECRET KEY
        it('Should pass when a valid live secret key is provided', () => {
            Shift4API.verifySecretKey(true);
            assert(true, 'Callout failed');
        });
        it('Should fail when invalid live secret key is provided', () => {
            SitePreferences.custom.shift4payments__liveSecretKey = 'invalid';
            SitePreferences.commit();
            try {
                Shift4API.verifySecretKey(true);
                assert(false, 'Callout should have failed');
            } catch (e) {
                assert(true, 'Callout should have failed');
            }
        });
    });

    describe('Customer Requests', () => {
        it('Should create a customer', () => {
            const newCustomer = Shift4API.customer.create({ email: 'test@example.com' });
            assert(newCustomer.id.startsWith('cust_'), 'Customer ID was not created');
        });
        it('Should retrieve a customer', () => {
            const customer = Shift4API.customer.get('cust_1234567890');
            assert(customer.id.startsWith('cust_'), 'Customer ID was not retrieved');
        });
        it('Should update a customer', () => {
            const customer = Shift4API.customer.update('cust_1234567890', { email: 'test@example.com' });
            assert(customer.id.startsWith('cust_'), 'Customer ID was not retrieved');
        });
        it('Should delete a customer', () => {
            Shift4API.customer.delete('cust_1234567890');
            assert(true, 'Callout failed');
        });
        describe('Customer Cards', () => {
            it('Should add a card to a customer', () => {
                const card = Shift4API.customer.cards.add('cust_1234567890', { card_number: '4111111111111111' });
                assert(card.id.startsWith('card_'), 'Card ID was not created');
            });
            it('Should remove a card from a customer', () => {
                Shift4API.customer.cards.remove('cust_1234567890', 'card_1234567890');
                assert(true, 'Callout failed');
            });
        });
    });

    describe('Token Requests', () => {
        it('Should create a token', () => {
            const token = Shift4API.token.create({ card_number: '4111111111111111' });
            assert(token.id.startsWith('tok_'), 'Token ID was not created');
        });
    });

    describe('APM Requests', () => {
        it('Should create an Apple Pay payment method', () => {
            const apm = Shift4API.apm.create({
                customerId: 'cust_1234567890',
                type: 'apple_pay',
                applePay: {
                    token: {
                        data: 'TEST_TOKEN:500USD'
                    }
                }
            });
            assert(apm.id.startsWith('pm_'), 'Apple Pay APM ID was not created');
        });
    });

    describe('Charge Requests', () => {
        it('Should create a charge', () => {
            const charge = Shift4API.charge.create({
                card_number: '4111111111111111',
                amount: 100,
                currency: 'USD'
            });
            assert(charge.id.startsWith('char_'), 'Charge ID was not created');
        });
    });
});

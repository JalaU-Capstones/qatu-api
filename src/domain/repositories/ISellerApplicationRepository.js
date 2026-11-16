export class ISellerApplicationRepository {
  // eslint-disable-next-line no-unused-vars
  async create(_application, _options) {
    throw new Error('Method create() must be implemented');
  }
  // eslint-disable-next-line no-unused-vars
  async findPendingByProfileId(_profileId, _options) {
    throw new Error('Method findPendingByProfileId() must be implemented');
  }
  // eslint-disable-next-line no-unused-vars
  async findLatestByProfileId(_profileId, _options) {
    throw new Error('Method findLatestByProfileId() must be implemented');
  }
  // eslint-disable-next-line no-unused-vars
  async findById(id, { transaction }) {
    throw new Error('Method findById() must be implemented');
  }

  // eslint-disable-next-line no-unused-vars
  async findAllPaginated({ status, page = 1, limit = 20 }) {
    throw new Error('Method findAllPaginated() must be implemented');
  }

  // eslint-disable-next-line no-unused-vars
  async review({ id, status, reviewedBy, rejectionReason = null }, { transaction }) {
    throw new Error('Method review() must be implemented');
  }
}

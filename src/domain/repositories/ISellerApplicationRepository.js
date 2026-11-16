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
}

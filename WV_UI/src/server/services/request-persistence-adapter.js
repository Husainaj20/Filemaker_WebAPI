export class RequestPersistenceAdapter {
  constructor(options) {
    this.service = options.service;
  }

  async health() {
    return this.service.health();
  }

  async listRecords(filters = {}) {
    return this.service.listRecords(filters);
  }

  async listParents(filters = {}) {
    return this.service.listParents(filters);
  }

  async listRequests(filters = {}) {
    return this.service.listRequestsFiltered(filters);
  }

  async getRequestById(requestId) {
    return this.service.getRequest(requestId);
  }

  async getRequestAudit(requestId) {
    return this.service.listAuditEvents(requestId);
  }

  async addRequestNote(requestId, note, actor) {
    return this.service.addRequestNote(requestId, note, actor);
  }

  async getRequestDocuments(requestId) {
    return this.service.listRequestDocuments(requestId);
  }

  async addDocumentPlaceholder(requestId, input, actor) {
    return this.service.addDocumentPlaceholder(requestId, input, actor);
  }

  async updateRequestResponse(requestId, patch, actor) {
    return this.service.updateResponse(requestId, patch, actor);
  }

  async getReportSummary(filters = {}) {
    return this.service.getReportSummary(filters);
  }

  async listRequestsForExport(filters = {}) {
    return this.service.listRequestsForExport(filters);
  }

  async createRequest(input, actor) {
    return this.service.createRequest(input, actor);
  }

  async updateRequest(requestId, input, actor) {
    return this.service.updateRequest(requestId, input, actor);
  }

  async sendRequest(requestId, actor) {
    return this.service.sendRequest(requestId, actor);
  }

  async startRequest(requestId, actor) {
    return this.service.startRequest(requestId, actor);
  }

  async completeRequest(requestId, actor) {
    return this.service.completeRequest(requestId, actor);
  }

  async transitionRequest(requestId, targetStage, actor, reason) {
    return this.service.transitionRequest(
      requestId,
      targetStage,
      actor,
      reason,
    );
  }

  async downloadDocument(requestId, kind) {
    return this.service.downloadDocument(requestId, kind);
  }

  async v2ReadinessProbe() {
    return this.service.v2ReadinessProbe();
  }

  async containerMappingProbe() {
    return this.service.containerMappingProbe();
  }

  async stabilityProbe(iterations) {
    return this.service.stabilityProbe(iterations);
  }

  async deploymentReadinessProbe() {
    return this.service.deploymentReadinessProbe();
  }
}

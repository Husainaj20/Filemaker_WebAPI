import { apiClient, ApiError } from "./api-client.js";
import {
  createEmptyRequest,
  createId,
  humanizeStage,
  normalizeRequest,
} from "../shared/requests/request-model.js";
import {
  APPROVAL_STATES,
  getAvailableTransitions,
  STAGES,
} from "../shared/requests/request-workflow.js";
import {
  getRecipientById,
  getRequestTypeByCode,
  getSubTypes,
  RECIPIENT_OPTIONS,
  REPORTING_CODE_OPTIONS,
  REQUEST_TYPES,
} from "../shared/requests/request-types.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function setPath(target, path, value) {
  const parts = path.split(".");
  let cursor = target;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const key = parts[index];
    cursor[key] =
      cursor[key] && typeof cursor[key] === "object" ? cursor[key] : {};
    cursor = cursor[key];
  }
  cursor[parts.at(-1)] = value;
}

function getPath(target, path) {
  return path.split(".").reduce((cursor, part) => cursor?.[part], target);
}

async function fileToAttachment(file) {
  const buffer = await file.arrayBuffer();
  const binary = new Uint8Array(buffer);
  let text = "";
  for (let index = 0; index < binary.length; index += 1) {
    text += String.fromCharCode(binary[index]);
  }

  return {
    id: createId("att"),
    name: file.name,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    uploadedAt: new Date().toISOString(),
    base64: btoa(text),
  };
}

function optionMarkup(options, currentValue, placeholder = "Select") {
  const items = [`<option value="">${escapeHtml(placeholder)}</option>`];
  for (const option of options) {
    const optionValue = option.id ?? option.value ?? option.code;
    items.push(
      `<option value="${escapeHtml(optionValue)}" ${
        String(optionValue) === String(currentValue) ? "selected" : ""
      }>${escapeHtml(option.label)}</option>`,
    );
  }
  return items.join("");
}

export class ExcessLandApp {
  constructor(root) {
    this.root = root;
    this.state = {
      activeModule: "requests",
      selectedTab: "overview",
      selectedRequestId: "",
      requests: [],
      parents: [],
      filters: {
        query: "",
        stage: "",
        typeCode: "",
        parentRecordId: "",
        activeOnly: true,
      },
      health: null,
      loading: true,
      saving: false,
      flash: null,
      dirtyIds: new Set(),
      createModal: {
        open: false,
        errors: [],
        draft: {
          requestNumber: "",
          title: "",
          requester: "",
          recordId: "",
          recordLabel: "",
          district: "",
          county: "",
          location: "",
          parcel: "",
          ea: "",
          route: "",
          pm: "",
          priority: "medium",
          assignedTo: "",
          description: "",
        },
      },
      noteDraft: {
        category: "workflow",
        text: "",
      },
      documentDraft: {
        type: "supporting",
        name: "",
        containerField: "",
      },
      detailDocuments: [],
    };

    this.handleClick = this.handleClick.bind(this);
    this.handleInput = this.handleInput.bind(this);
    this.handleChange = this.handleChange.bind(this);
  }

  async init() {
    this.root.addEventListener("click", this.handleClick);
    this.root.addEventListener("input", this.handleInput);
    this.root.addEventListener("change", this.handleChange);
    await this.reload();
  }

  async reload(options = {}) {
    const preserveFlash = options.preserveFlash === true;
    this.state.loading = true;
    this.render();

    try {
      const health = await apiClient.getHealth();
      this.state.health = health;

      const [recordsResult, requestsResult] = await Promise.allSettled([
        apiClient.listRecords({ activeOnly: this.state.filters.activeOnly }),
        apiClient.listRequests({
          parentRecordId: this.state.filters.parentRecordId,
          activeOnly: this.state.filters.activeOnly,
        }),
      ]);

      if (recordsResult.status === "fulfilled") {
        const payload = recordsResult.value;
        const records = Array.isArray(payload?.records) ? payload.records : [];
        this.state.parents = records.map((record) => ({
          recordId: record.id,
          recordLabel: record.displayName,
          activeCount: Number(record.activeRequestCount || 0),
          totalCount: Number(record.totalRequestCount || 0),
        }));
      }

      if (requestsResult.status === "fulfilled") {
        const requests = Array.isArray(requestsResult.value)
          ? requestsResult.value
          : [];
        this.state.requests = requests.map((request) =>
          normalizeRequest(request),
        );
      }

      if (
        recordsResult.status === "rejected" ||
        requestsResult.status === "rejected"
      ) {
        const firstError =
          recordsResult.status === "rejected"
            ? recordsResult.reason
            : requestsResult.reason;
        this.state.flash = {
          tone: "danger",
          message: this.describeError(firstError),
        };
      } else if (!preserveFlash) {
        this.state.flash = null;
      }

      this.state.selectedRequestId =
        this.state.selectedRequestId || this.state.requests[0]?.id || "";
    } catch (error) {
      this.state.flash = {
        tone: "danger",
        message: this.describeError(error),
      };
    } finally {
      this.state.loading = false;
      this.render();
    }

    if (this.state.selectedRequestId) {
      void this.loadRequestDetail(this.state.selectedRequestId, { silent: true });
    }
  }

  async loadRequestDetail(requestId, options = {}) {
    if (!requestId) return;

    try {
      const [requestResult, auditResult, documentsResult] =
        await Promise.allSettled([
          apiClient.getRequestById(requestId),
          apiClient.getRequestAudit(requestId),
          apiClient.listRequestDocuments(requestId),
        ]);

      if (requestResult.status === "fulfilled") {
        const request = normalizeRequest(requestResult.value);

        if (auditResult.status === "fulfilled") {
          const auditItems = Array.isArray(auditResult.value)
            ? auditResult.value
            : [];
          request.auditEvents = auditItems;
          request.history = auditItems.map((event) => ({
            id: event.id,
            kind: event.type || "event",
            message: event.label || "",
            actor: event.actor || "system",
            createdAt: event.timestamp || new Date().toISOString(),
            notes: event.notes || "",
          }));
        }

        if (documentsResult.status === "fulfilled") {
          const documentItems = Array.isArray(documentsResult.value)
            ? documentsResult.value
            : [];
          this.state.detailDocuments = documentItems;
          request.documents.placeholders = documentItems.filter(
            (document) =>
              String(document.status || "").toLowerCase() ===
              "placeholder",
          );
        }

        this.upsertRequest(request);
        this.clearDirty(request.id);
        if (!options.silent) {
          this.render();
        }
      }
    } catch (error) {
      if (!options.silent) {
        this.state.flash = {
          tone: "danger",
          message: this.describeError(error),
        };
        this.render();
      }
    }
  }

  describeError(error) {
    if (error instanceof ApiError) {
      return `${error.message}${error.traceId ? ` Trace: ${error.traceId}` : ""}`;
    }
    return error instanceof Error ? error.message : String(error);
  }

  getFriendlyStageLabel(stage) {
    const key = String(stage || "").toLowerCase();
    const labels = {
      draft: "Draft",
      request_sent: "Request Sent",
      waiting_response: "Waiting Response / In Progress",
      completed: "Completed",
    };
    return labels[key] || humanizeStage(key || STAGES.DRAFT);
  }

  getLifecycleButtonState(request) {
    const currentStage = String(request?.stage || STAGES.DRAFT);
    return {
      canSend: currentStage === STAGES.DRAFT,
      canStart: currentStage === STAGES.REQUEST_SENT,
      canComplete: currentStage === STAGES.WAITING_RESPONSE,
    };
  }

  get selectedRequest() {
    return (
      this.state.requests.find(
        (request) =>
          String(request.id) === String(this.state.selectedRequestId),
      ) || null
    );
  }

  get filteredRequests() {
    return this.state.requests.filter((request) => {
      const query = this.state.filters.query.trim().toLowerCase();
      const matchesQuery =
        !query ||
        request.title.toLowerCase().includes(query) ||
        request.recordLabel.toLowerCase().includes(query) ||
        request.recordId.toLowerCase().includes(query);
      const matchesStage =
        !this.state.filters.stage || request.stage === this.state.filters.stage;
      const matchesType =
        !this.state.filters.typeCode ||
        request.typeCode === this.state.filters.typeCode;
      return matchesQuery && matchesStage && matchesType;
    });
  }

  markDirty(requestId) {
    this.state.dirtyIds.add(String(requestId));
  }

  clearDirty(requestId) {
    this.state.dirtyIds.delete(String(requestId));
  }

  upsertRequest(nextRequest) {
    const index = this.state.requests.findIndex(
      (request) => String(request.id) === String(nextRequest.id),
    );

    if (index === -1) {
      this.state.requests.unshift(normalizeRequest(nextRequest));
    } else {
      this.state.requests[index] = normalizeRequest(nextRequest);
    }

    this.state.selectedRequestId = nextRequest.id;
  }

  updateSelected(mutator, options = {}) {
    const selected = this.selectedRequest;
    if (!selected) return;
    mutator(selected);
    selected.updatedAt = new Date().toISOString();
    this.markDirty(selected.id);
    if (options.render !== false) {
      this.render();
    }
  }

  async createRequest(input) {
    const draft = createEmptyRequest(input || {});

    try {
      const created = await apiClient.createRequest(draft);
      this.upsertRequest(created);
      this.clearDirty(created.id);
      this.state.selectedTab = "overview";
      this.state.flash = {
        tone: "success",
        message: "New request created.",
      };
      this.state.createModal.open = false;
      this.state.createModal.errors = [];
      this.render();
    } catch (error) {
      this.state.flash = {
        tone: "danger",
        message: this.describeError(error),
      };
      this.render();
    }
  }

  async saveSelected() {
    const selected = this.selectedRequest;
    if (!selected) return;

    this.state.saving = true;
    this.render();

    try {
      const saved = await apiClient.updateRequest(selected.id, selected);
      this.upsertRequest(saved);
      this.clearDirty(saved.id);
      this.state.flash = {
        tone: "success",
        message: "Request saved.",
      };
    } catch (error) {
      this.state.flash = {
        tone: "danger",
        message: this.describeError(error),
      };
    } finally {
      this.state.saving = false;
      this.render();
    }
  }

  async runTransition(targetStage) {
    const selected = this.selectedRequest;
    if (!selected) return;

    this.state.saving = true;
    this.render();

    try {
      // Persist unsaved edits (especially document attachments) before transition validation.
      if (this.state.dirtyIds.has(String(selected.id))) {
        const savedBeforeTransition = await apiClient.updateRequest(
          selected.id,
          selected,
        );
        this.upsertRequest(savedBeforeTransition);
        this.clearDirty(savedBeforeTransition.id);
      }

      const saved = await apiClient.transitionRequest(selected.id, targetStage);
      this.upsertRequest(saved);
      this.clearDirty(saved.id);
      this.state.flash = {
        tone: "success",
        message: `Moved to ${humanizeStage(targetStage)}.`,
      };
    } catch (error) {
      this.state.flash = {
        tone: "danger",
        message: this.describeError(error),
      };
    } finally {
      this.state.saving = false;
      this.render();
    }
  }

  openCreateRequestModal() {
    const template = createEmptyRequest({
      title: "",
      requester: "",
      recordLabel: "",
      recordId: "",
      description: "",
    });

    this.state.createModal = {
      open: true,
      errors: [],
      draft: {
        requestNumber: template.requestNumber,
        title: "",
        requester: "",
        recordId: "",
        recordLabel: "",
        district: "",
        county: "",
        location: "",
        parcel: "",
        ea: "",
        route: "",
        pm: "",
        priority: "medium",
        assignedTo: "",
        description: "",
      },
    };
    this.render();
  }

  closeCreateRequestModal() {
    this.state.createModal.open = false;
    this.state.createModal.errors = [];
    this.render();
  }

  async submitCreateRequest() {
    const draft = this.state.createModal.draft;
    const errors = [];

    if (!String(draft.title || "").trim()) {
      errors.push("Title is required.");
    }
    if (!String(draft.requester || "").trim()) {
      errors.push("Requester is required.");
    }

    if (errors.length) {
      this.state.createModal.errors = errors;
      this.render();
      return;
    }

    await this.createRequest({
      requestNumber: draft.requestNumber,
      title: draft.title,
      requester: draft.requester,
      recordId: draft.recordId,
      recordLabel: draft.recordLabel,
      district: draft.district,
      county: draft.county,
      location: draft.location,
      parcel: draft.parcel,
      ea: draft.ea,
      route: draft.route,
      pm: draft.pm,
      priority: draft.priority,
      assignedTo: draft.assignedTo,
      description: draft.description,
      requestDetails: {
        requester: draft.requester,
        district: draft.district,
        county: draft.county,
        location: draft.location,
        parcel: draft.parcel,
        ea: draft.ea,
        route: draft.route,
        pm: draft.pm,
      },
    });
  }

  async runLifecycleAction(action) {
    const selected = this.selectedRequest;
    if (!selected) return;

    this.state.saving = true;
    this.render();

    try {
      if (this.state.dirtyIds.has(String(selected.id))) {
        const savedBeforeTransition = await apiClient.updateRequest(
          selected.id,
          selected,
        );
        this.upsertRequest(savedBeforeTransition);
        this.clearDirty(savedBeforeTransition.id);
      }

      let saved = null;
      let message = "";
      if (action === "send") {
        saved = await apiClient.sendRequest(selected.id);
        message = "Request sent.";
      } else if (action === "start") {
        saved = await apiClient.startRequest(selected.id);
        message = "Request moved to Waiting Response / In Progress.";
      } else if (action === "complete") {
        saved = await apiClient.completeRequest(selected.id);
        message = "Request completed.";
      }

      if (saved) {
        this.upsertRequest(saved);
        this.clearDirty(saved.id);
      }

      this.state.flash = {
        tone: "success",
        message,
      };

      await this.reload({ preserveFlash: true });
    } catch (error) {
      this.state.flash = {
        tone: "danger",
        message: this.describeError(error),
      };
    } finally {
      this.state.saving = false;
      this.render();
    }
  }

  async downloadAttachment(kind) {
    const selected = this.selectedRequest;
    if (!selected) return;

    try {
      const file = await apiClient.downloadDocument(selected.id, kind);
      const blobUrl = URL.createObjectURL(file.blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = file.fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      this.state.flash = {
        tone: "danger",
        message: this.describeError(error),
      };
      this.render();
    }
  }

  async attachFiles(kind, fileList) {
    if (!fileList?.length) return;
    const attachments = [];
    for (const file of Array.from(fileList)) {
      attachments.push(await fileToAttachment(file));
    }

    this.updateSelected((request) => {
      if (kind === "requestPdf") {
        request.documents.requestPdf = attachments[0];
      } else if (kind === "responsePdf") {
        request.documents.responsePdf = attachments[0];
      } else if (kind === "relatedUploads") {
        request.documents.relatedUploads.unshift(...attachments);
      } else if (kind === "responseUploads") {
        request.documents.responseUploads.unshift(...attachments);
      }
    });
  }

  removeAttachment(kind, attachmentId) {
    this.updateSelected((request) => {
      if (kind === "requestPdf") {
        request.documents.requestPdf = null;
      } else if (kind === "responsePdf") {
        request.documents.responsePdf = null;
      } else {
        request.documents[kind] = request.documents[kind].filter(
          (attachment) => attachment.id !== attachmentId,
        );
      }
    });
  }

  async commitNote() {
    const selected = this.selectedRequest;
    const body = this.state.noteDraft.text.trim();
    if (!selected || !body) return;

    this.state.saving = true;
    this.render();

    try {
      const saved = await apiClient.addRequestNote(selected.id, {
        category: this.state.noteDraft.category,
        body,
        author: "web_operator",
      });
      this.upsertRequest(saved);
      this.clearDirty(saved.id);
      this.state.noteDraft.text = "";
      this.state.flash = {
        tone: "success",
        message: "Note added.",
      };
      await this.loadRequestDetail(saved.id, { silent: true });
    } catch (error) {
      this.state.flash = {
        tone: "danger",
        message: this.describeError(error),
      };
    } finally {
      this.state.saving = false;
      this.render();
    }
  }

  async addDocumentPlaceholder() {
    const selected = this.selectedRequest;
    if (!selected) return;

    const name = String(this.state.documentDraft.name || "").trim();
    if (!name) {
      this.state.flash = {
        tone: "danger",
        message: "Document placeholder name is required.",
      };
      this.render();
      return;
    }

    this.state.saving = true;
    this.render();
    try {
      const saved = await apiClient.addDocumentPlaceholder(selected.id, {
        type: this.state.documentDraft.type,
        name,
        fileName: name,
        status: "placeholder",
        source: "adapter-ready",
        containerField: this.state.documentDraft.containerField,
      });
      this.upsertRequest(saved);
      this.clearDirty(saved.id);
      this.state.documentDraft.name = "";
      await this.loadRequestDetail(saved.id, { silent: true });
      this.state.flash = {
        tone: "success",
        message: "Document placeholder added.",
      };
    } catch (error) {
      this.state.flash = {
        tone: "danger",
        message: this.describeError(error),
      };
    } finally {
      this.state.saving = false;
      this.render();
    }
  }

  async saveResponseMetadata() {
    const selected = this.selectedRequest;
    if (!selected) return;

    this.state.saving = true;
    this.render();

    try {
      const saved = await apiClient.updateResponse(selected.id, {
        status: selected.response.status,
        receivedAt: selected.response.receivedAt,
        completedOn: selected.response.completedOn,
        completedBy: selected.response.completedBy,
        responder: selected.response.responder,
        summary: selected.response.summary,
        notes: selected.response.notes,
        decision: selected.response.decision,
        value: selected.response.value,
        artifactName: selected.response.artifactName,
        artifactStatus: selected.response.artifactStatus,
      });
      this.upsertRequest(saved);
      this.clearDirty(saved.id);
      await this.loadRequestDetail(saved.id, { silent: true });
      this.state.flash = {
        tone: "success",
        message: "Response metadata updated.",
      };
    } catch (error) {
      this.state.flash = {
        tone: "danger",
        message: this.describeError(error),
      };
    } finally {
      this.state.saving = false;
      this.render();
    }
  }

  handleClick(event) {
    if (event.target.classList?.contains("modal-backdrop")) {
      this.closeCreateRequestModal();
      return;
    }

    const actionTarget = event.target.closest("[data-action]");
    if (!actionTarget) return;

    const action = actionTarget.dataset.action;
    if (action === "module") {
      const moduleName = actionTarget.dataset.module;
      if (moduleName !== "requests") {
        this.state.flash = {
          tone: "info",
          message: `${moduleName} is planned but not implemented in this migration slice.`,
        };
      }
      this.state.activeModule = moduleName;
      this.render();
      return;
    }

    if (action === "select-request") {
      this.state.selectedRequestId = actionTarget.dataset.requestId;
      this.render();
      void this.loadRequestDetail(this.state.selectedRequestId, { silent: true });
      return;
    }

    if (action === "new-request") {
      this.openCreateRequestModal();
      return;
    }

    if (action === "create-request-cancel") {
      this.closeCreateRequestModal();
      return;
    }

    if (action === "create-request-submit") {
      void this.submitCreateRequest();
      return;
    }

    if (action === "save-request") {
      void this.saveSelected();
      return;
    }

    if (action === "reload") {
      void this.reload();
      return;
    }

    if (action === "switch-tab") {
      this.state.selectedTab = actionTarget.dataset.tab;
      this.render();
      return;
    }

    if (action === "transition-request") {
      void this.runTransition(actionTarget.dataset.stage);
      return;
    }

    if (action === "add-note") {
      void this.commitNote();
      return;
    }

    if (action === "add-document-placeholder") {
      void this.addDocumentPlaceholder();
      return;
    }

    if (action === "save-response") {
      void this.saveResponseMetadata();
      return;
    }

    if (action === "remove-attachment") {
      this.removeAttachment(
        actionTarget.dataset.kind,
        actionTarget.dataset.attachmentId,
      );
      return;
    }

    if (action === "download-attachment") {
      void this.downloadAttachment(actionTarget.dataset.kind);
      return;
    }

    if (action === "send-request") {
      void this.runLifecycleAction("send");
      return;
    }

    if (action === "start-request") {
      void this.runLifecycleAction("start");
      return;
    }

    if (action === "complete-request") {
      void this.runLifecycleAction("complete");
      return;
    }
  }

  handleInput(event) {
    const fieldTarget = event.target.closest("[data-path]");
    if (fieldTarget) {
      const value =
        fieldTarget.type === "checkbox"
          ? fieldTarget.checked
          : fieldTarget.value;
      const requiresRerender = ["typeCode", "recipientId"].includes(
        fieldTarget.dataset.path,
      );
      this.updateSelected(
        (request) => {
          setPath(request, fieldTarget.dataset.path, value);

          if (fieldTarget.dataset.path === "typeCode") {
            request.subTypeCode = "";
          }

          if (fieldTarget.dataset.path === "recipientId") {
            const recipient = getRecipientById(value);
            if (recipient && !request.requestEmail.to) {
              request.requestEmail.to = recipient.email || "";
            }
          }
        },
        { render: requiresRerender },
      );
      return;
    }

    if (event.target.matches("[data-filter]")) {
      const filterKey = event.target.dataset.filter;
      this.state.filters[filterKey] =
        event.target.type === "checkbox"
          ? event.target.checked
          : event.target.value;

      if (["parentRecordId", "activeOnly"].includes(filterKey)) {
        void this.reload();
        return;
      }

      this.render();
      return;
    }

    if (event.target.matches("[data-note-field]")) {
      this.state.noteDraft[event.target.dataset.noteField] = event.target.value;
      return;
    }

    if (event.target.matches("[data-document-field]")) {
      this.state.documentDraft[event.target.dataset.documentField] =
        event.target.value;
      return;
    }

    if (event.target.matches("[data-create-field]")) {
      this.state.createModal.draft[event.target.dataset.createField] =
        event.target.value;
    }
  }

  handleChange(event) {
    if (event.target.matches("[data-upload]")) {
      void this.attachFiles(event.target.dataset.upload, event.target.files);
      event.target.value = "";
    }
  }

  renderDynamicFields() {
    const selected = this.selectedRequest;
    if (!selected?.typeCode) {
      return `
        <div class="empty-panel">
          <h3>Select request type</h3>
          <p>The request module is ready for multiple workflows, but details stay canonical and backend-owned.</p>
        </div>
      `;
    }

    const requestType = getRequestTypeByCode(selected.typeCode);
    if (!requestType) return "";

    return requestType.sections
      .map(
        (section) => `
          <section class="card">
            <div class="card-header">
              <h3>${escapeHtml(section.title)}</h3>
            </div>
            <div class="detail-grid">
              ${section.fields
                .map((field) => {
                  const value =
                    getPath(selected.requestDetails, field.key) || "";
                  if (field.component === "textarea") {
                    return `
                      <label class="field span-2">
                        <span>${escapeHtml(field.label)}</span>
                        <textarea data-path="requestDetails.${escapeHtml(field.key)}" rows="3">${escapeHtml(value)}</textarea>
                      </label>
                    `;
                  }

                  if (field.component === "select") {
                    return `
                      <label class="field">
                        <span>${escapeHtml(field.label)}</span>
                        <select data-path="requestDetails.${escapeHtml(field.key)}">
                          ${optionMarkup(field.options, value)}
                        </select>
                      </label>
                    `;
                  }

                  return `
                    <label class="field">
                      <span>${escapeHtml(field.label)}</span>
                      <input
                        type="${field.component === "date" ? "date" : "text"}"
                        data-path="requestDetails.${escapeHtml(field.key)}"
                        value="${escapeHtml(value)}"
                      >
                    </label>
                  `;
                })
                .join("")}
            </div>
          </section>
        `,
      )
      .join("");
  }

  renderDocuments() {
    const request = this.selectedRequest;
    if (!request) return "";
    const apiDocuments = Array.isArray(this.state.detailDocuments)
      ? this.state.detailDocuments
      : [];
    const placeholders = Array.isArray(request.documents?.placeholders)
      ? request.documents.placeholders
      : [];

    const renderAttachmentList = (kind, attachments) =>
      attachments.length
        ? `<div class="attachment-list">${attachments
            .map(
              (attachment) => `
                <div class="attachment-row">
                  <div>
                    <strong>${escapeHtml(attachment.name)}</strong>
                    <div class="subtle">${escapeHtml(attachment.mimeType || "")}</div>
                  </div>
                  <div>
                    <button class="link-button" data-action="download-attachment" data-kind="${escapeHtml(kind)}">Download</button>
                    <button class="link-button" data-action="remove-attachment" data-kind="${escapeHtml(kind)}" data-attachment-id="${escapeHtml(attachment.id)}">Remove</button>
                  </div>
                </div>
              `,
            )
            .join("")}</div>`
        : `<div class="empty-inline">No files attached.</div>`;

    return `
      <section class="card">
        <div class="card-header">
          <h3>Document Placeholders</h3>
        </div>
        <div class="subtle">API catalog entries: ${apiDocuments.length}</div>
        <div class="detail-grid">
          <label class="field">
            <span>Type</span>
            <select data-document-field="type">
              ${optionMarkup(
                [
                  { value: "supporting", label: "Supporting" },
                  { value: "request", label: "Request Email Artifact" },
                  { value: "response", label: "Response Artifact" },
                ],
                this.state.documentDraft.type,
              )}
            </select>
          </label>
          <label class="field">
            <span>Name</span>
            <input type="text" data-document-field="name" value="${escapeHtml(
              this.state.documentDraft.name,
            )}" placeholder="Example: Response package PDF">
          </label>
          <label class="field">
            <span>Container Field (optional)</span>
            <input type="text" data-document-field="containerField" value="${escapeHtml(
              this.state.documentDraft.containerField,
            )}" placeholder="Unconfirmed FileMaker container field">
          </label>
        </div>
        <button class="secondary-button" data-action="add-document-placeholder" ${
          this.state.saving ? "disabled" : ""
        }>Add Placeholder</button>
        <div class="timeline">
          ${
            placeholders.length
              ? placeholders
                  .map(
                    (placeholder) => `
                  <article class="timeline-item">
                    <div class="timeline-meta">${escapeHtml(
                      placeholder.type || "supporting",
                    )} · ${escapeHtml(
                      placeholder.status || "placeholder",
                    )} · ${escapeHtml(placeholder.uploadedAt || "")}</div>
                    <p>${escapeHtml(placeholder.name || placeholder.fileName || "Document")}</p>
                    <div class="subtle">Container: ${escapeHtml(placeholder.containerField || "(unconfirmed)")}</div>
                  </article>
                `,
                  )
                  .join("")
              : `<div class="empty-inline">No placeholders recorded.</div>`
          }
        </div>
      </section>
      <section class="card">
        <div class="card-header">
          <h3>Request Package</h3>
        </div>
        <div class="upload-stack">
          <label class="upload-control">
            <span>Request PDF</span>
            <input type="file" accept=".pdf,.doc,.docx,image/*" data-upload="requestPdf">
          </label>
          ${
            request.documents.requestPdf
              ? renderAttachmentList("requestPdf", [
                  request.documents.requestPdf,
                ])
              : `<div class="empty-inline">Request PDF not attached.</div>`
          }
        </div>
      </section>
      <section class="card">
        <div class="card-header">
          <h3>Response Files</h3>
        </div>
        <div class="upload-stack">
          <label class="upload-control">
            <span>Response PDF</span>
            <input type="file" accept=".pdf,.doc,.docx,image/*" data-upload="responsePdf">
          </label>
          ${
            request.documents.responsePdf
              ? renderAttachmentList("responsePdf", [
                  request.documents.responsePdf,
                ])
              : `<div class="empty-inline">Response PDF not attached.</div>`
          }
          <label class="upload-control">
            <span>Additional response files</span>
            <input type="file" accept=".pdf,.doc,.docx,image/*" data-upload="responseUploads" multiple>
          </label>
          ${renderAttachmentList("responseUploads", request.documents.responseUploads)}
        </div>
      </section>
      <section class="card">
        <div class="card-header">
          <h3>Supporting Uploads</h3>
        </div>
        <div class="upload-stack">
          <label class="upload-control">
            <span>Related uploads</span>
            <input type="file" accept=".pdf,.doc,.docx,image/*" data-upload="relatedUploads" multiple>
          </label>
          ${renderAttachmentList("relatedUploads", request.documents.relatedUploads)}
        </div>
      </section>
    `;
  }

  renderNotes() {
    const request = this.selectedRequest;
    if (!request) return "";

    return `
      <section class="card">
        <div class="card-header">
          <h3>Notes</h3>
        </div>
        <div class="note-composer">
          <select data-note-field="category">
            ${optionMarkup(
              [
                { value: "workflow", label: "Workflow" },
                { value: "operations", label: "Operations" },
                { value: "approval", label: "Approval" },
              ],
              this.state.noteDraft.category,
            )}
          </select>
          <textarea rows="3" data-note-field="text" placeholder="Add note with operational context.">${escapeHtml(this.state.noteDraft.text)}</textarea>
          <button class="primary-button" data-action="add-note">Add note</button>
        </div>
        <div class="timeline">
          ${
            request.notes.length
              ? request.notes
                  .map(
                    (note) => `
                    <article class="timeline-item">
                      <div class="timeline-meta">${escapeHtml(note.category)} · ${escapeHtml(note.author)} · ${escapeHtml(note.createdAt)}</div>
                      <p>${escapeHtml(note.text)}</p>
                    </article>
                  `,
                  )
                  .join("")
              : `<div class="empty-inline">No notes yet.</div>`
          }
        </div>
      </section>
    `;
  }

  renderHistory() {
    const request = this.selectedRequest;
    if (!request) return "";
    const events = Array.isArray(request.auditEvents) && request.auditEvents.length
      ? request.auditEvents
      : request.history.map((event) => ({
          id: event.id,
          type: event.kind || "event",
          label: event.message || "",
          actor: event.actor || "system",
          timestamp: event.createdAt || "",
          notes: event.notes || "",
        }));

    return `
      <section class="card">
        <div class="card-header">
          <h3>History</h3>
        </div>
        <div class="timeline">
          ${
            events.length
              ? events
                  .map(
                    (event) => `
                    <article class="timeline-item">
                      <div class="timeline-meta">${escapeHtml(event.type)} · ${escapeHtml(event.actor)} · ${escapeHtml(event.timestamp)}</div>
                      <p>${escapeHtml(event.label)}</p>
                      ${event.notes ? `<div class="subtle">${escapeHtml(event.notes)}</div>` : ""}
                    </article>
                  `,
                  )
                  .join("")
              : `<div class="empty-inline">No history recorded yet.</div>`
          }
        </div>
      </section>
    `;
  }

  renderCommunications() {
    const request = this.selectedRequest;
    if (!request) return "";

    return `
      <section class="card">
        <div class="card-header">
          <h3>Request Email</h3>
        </div>
        <div class="detail-grid">
          <label class="field span-2">
            <span>To</span>
            <input type="email" data-path="requestEmail.to" value="${escapeHtml(request.requestEmail.to)}">
          </label>
          <label class="field span-2">
            <span>Cc</span>
            <input type="text" data-path="requestEmail.cc" value="${escapeHtml(request.requestEmail.cc)}">
          </label>
          <label class="field span-2">
            <span>Subject</span>
            <input type="text" data-path="requestEmail.subject" value="${escapeHtml(request.requestEmail.subject)}">
          </label>
          <label class="field span-2">
            <span>Body</span>
            <textarea data-path="requestEmail.body" rows="4">${escapeHtml(request.requestEmail.body)}</textarea>
          </label>
          <label class="field">
            <span>Sent At</span>
            <input type="date" data-path="requestEmail.sentAt" value="${escapeHtml(request.requestEmail.sentAt)}">
          </label>
        </div>
      </section>
      <section class="card">
        <div class="card-header">
          <h3>Response</h3>
        </div>
        <div class="detail-grid">
          <label class="field">
            <span>Response status</span>
            <input type="text" data-path="response.status" value="${escapeHtml(request.response.status)}">
          </label>
          <label class="field">
            <span>Received At</span>
            <input type="date" data-path="response.receivedAt" value="${escapeHtml(request.response.receivedAt)}">
          </label>
          <label class="field">
            <span>Completed On</span>
            <input type="date" data-path="response.completedOn" value="${escapeHtml(request.response.completedOn)}">
          </label>
          <label class="field">
            <span>Completed By</span>
            <input type="text" data-path="response.completedBy" value="${escapeHtml(request.response.completedBy || "")}">
          </label>
          <label class="field">
            <span>Responder</span>
            <input type="text" data-path="response.responder" value="${escapeHtml(request.response.responder)}">
          </label>
          <label class="field span-2">
            <span>Summary</span>
            <textarea data-path="response.summary" rows="3">${escapeHtml(request.response.summary)}</textarea>
          </label>
          <label class="field span-2">
            <span>Notes</span>
            <textarea data-path="response.notes" rows="3">${escapeHtml(request.response.notes)}</textarea>
          </label>
          <label class="field">
            <span>Decision</span>
            <select data-path="approval.state">
              ${optionMarkup(
                [
                  { value: APPROVAL_STATES.PENDING, label: "Pending" },
                  { value: APPROVAL_STATES.APPROVED, label: "Approved" },
                  { value: APPROVAL_STATES.DENIED, label: "Denied" },
                  { value: APPROVAL_STATES.HOLD, label: "On Hold" },
                ],
                request.approval.state,
              )}
            </select>
          </label>
          <label class="field">
            <span>Approved By</span>
            <input type="text" data-path="approval.by" value="${escapeHtml(request.approval.by)}">
          </label>
          <label class="field span-2">
            <span>Response Artifact Name</span>
            <input type="text" data-path="response.artifactName" value="${escapeHtml(request.response.artifactName || "")}" placeholder="Placeholder until FileMaker container mapping is confirmed">
          </label>
          <label class="field">
            <span>Response Artifact Status</span>
            <select data-path="response.artifactStatus">
              ${optionMarkup(
                [
                  { value: "", label: "Not set" },
                  { value: "placeholder", label: "Placeholder" },
                  { value: "uploaded", label: "Uploaded" },
                  { value: "metadata_only", label: "Metadata Only" },
                ],
                request.response.artifactStatus || "",
              )}
            </select>
          </label>
        </div>
        <div class="modal-actions">
          <button class="secondary-button" data-action="save-response" ${
            this.state.saving ? "disabled" : ""
          }>Update Response Metadata</button>
        </div>
      </section>
    `;
  }

  renderDetailsPane() {
    const request = this.selectedRequest;
    if (!request) {
      return `
        <section class="workspace-empty">
          <h2>No request selected</h2>
          <p>Create a request to begin the backend-backed workflow.</p>
          <button class="primary-button" data-action="new-request">Create request</button>
        </section>
      `;
    }

    const requestType = getRequestTypeByCode(request.typeCode);
    const subTypes = getSubTypes(request.typeCode);
    const transitions = getAvailableTransitions(request).slice(0, 5);

    let tabContent = "";
    if (this.state.selectedTab === "overview") {
      tabContent = `
        <section class="card">
          <div class="card-header">
            <h3>Request Setup</h3>
          </div>
          <div class="detail-grid">
            <label class="field span-2">
              <span>Title</span>
              <input type="text" data-path="title" value="${escapeHtml(request.title)}">
            </label>
            <label class="field">
              <span>Request Number</span>
              <input type="text" data-path="requestNumber" value="${escapeHtml(request.requestNumber)}">
            </label>
            <label class="field">
              <span>Requester</span>
              <input type="text" data-path="requester" value="${escapeHtml(request.requester)}">
            </label>
            <label class="field">
              <span>Record Label</span>
              <input type="text" data-path="recordLabel" value="${escapeHtml(request.recordLabel)}">
            </label>
            <label class="field">
              <span>Record Id</span>
              <input type="text" data-path="recordId" value="${escapeHtml(request.recordId)}">
            </label>
            <label class="field">
              <span>Assigned To</span>
              <input type="text" data-path="assignedTo" value="${escapeHtml(request.assignedTo)}">
            </label>
            <label class="field">
              <span>Location</span>
              <input type="text" data-path="location" value="${escapeHtml(request.location)}">
            </label>
            <label class="field">
              <span>Request Type</span>
              <select data-path="typeCode">
                ${optionMarkup(REQUEST_TYPES, request.typeCode)}
              </select>
            </label>
            <label class="field">
              <span>Sub-request</span>
              <select data-path="subTypeCode">
                ${optionMarkup(subTypes, request.subTypeCode)}
              </select>
            </label>
            <label class="field">
              <span>Recipient</span>
              <select data-path="recipientId">
                ${optionMarkup(RECIPIENT_OPTIONS, request.recipientId)}
              </select>
            </label>
            <label class="field">
              <span>Reporting Code</span>
              <select data-path="reportingCodeId">
                ${optionMarkup(REPORTING_CODE_OPTIONS, request.reportingCodeId)}
              </select>
            </label>
            <label class="field">
              <span>Request Date</span>
              <input type="date" data-path="requestDate" value="${escapeHtml(request.requestDate)}">
            </label>
            <label class="field">
              <span>Due Date</span>
              <input type="date" data-path="dueDate" value="${escapeHtml(request.dueDate)}">
            </label>
            <label class="field">
              <span>Priority</span>
              <select data-path="priority">
                ${optionMarkup(
                  [
                    { value: "low", label: "Low" },
                    { value: "medium", label: "Medium" },
                    { value: "high", label: "High" },
                  ],
                  request.priority,
                )}
              </select>
            </label>
            <label class="field span-2">
              <span>Description</span>
              <textarea data-path="description" rows="4">${escapeHtml(request.description)}</textarea>
            </label>
          </div>
        </section>
      `;
    } else if (this.state.selectedTab === "details") {
      tabContent = this.renderDynamicFields();
    } else if (this.state.selectedTab === "communications") {
      tabContent = this.renderCommunications();
    } else if (this.state.selectedTab === "documents") {
      tabContent = this.renderDocuments();
    } else if (this.state.selectedTab === "notes") {
      tabContent = this.renderNotes();
    } else if (this.state.selectedTab === "history") {
      tabContent = this.renderHistory();
    }

    const recipient = getRecipientById(request.recipientId);
    const lifecycleButtons = this.getLifecycleButtonState(request);

    return `
      <section class="workspace-header">
        <div>
          <div class="eyebrow">Request Workspace</div>
          <h1>${escapeHtml(request.title)}</h1>
          <p class="subtle">${escapeHtml(request.recordLabel || "Unassigned Record")} · ${escapeHtml(requestType?.label || "Request type not set")} · ${escapeHtml(recipient?.label || "Recipient not set")}</p>
        </div>
        <div class="workspace-actions">
          <span class="stage-badge">${escapeHtml(this.getFriendlyStageLabel(request.stage))}</span>
          <button class="secondary-button" data-action="reload">Reload</button>
          <button class="primary-button" data-action="save-request" ${
            this.state.saving ? "disabled" : ""
          }>${this.state.saving ? "Saving..." : "Save request"}</button>
        </div>
      </section>
      <section class="workspace-layout">
        <div class="workspace-main">
          <div class="tab-strip">
            ${[
              "overview",
              "details",
              "communications",
              "documents",
              "notes",
              "history",
            ]
              .map(
                (tab) => `
                  <button class="${
                    this.state.selectedTab === tab
                      ? "tab-button active"
                      : "tab-button"
                  }" data-action="switch-tab" data-tab="${tab}">${escapeHtml(
                    tab.charAt(0).toUpperCase() + tab.slice(1),
                  )}</button>
                `,
              )
              .join("")}
          </div>
          ${tabContent}
        </div>
        <aside class="workspace-side">
          <section class="card side-card">
            <div class="card-header">
              <h3>Workflow</h3>
            </div>
            <div class="meta-stack">
              <div><span>Current stage</span><strong>${escapeHtml(this.getFriendlyStageLabel(request.stage))}</strong></div>
              <div><span>Sent At</span><strong>${escapeHtml(request.requestEmail.sentAt || "Not sent")}</strong></div>
              <div><span>Completed On</span><strong>${escapeHtml(request.response.completedOn || "Not completed")}</strong></div>
              <div><span>Approval</span><strong>${escapeHtml(request.approval.state)}</strong></div>
              <div><span>Last updated</span><strong>${escapeHtml(request.updatedAt)}</strong></div>
            </div>
            <div class="transition-list">
              <button class="primary-button block-button" data-action="send-request" ${
                this.state.saving || !lifecycleButtons.canSend ? "disabled" : ""
              }>Send Request</button>
              <button class="secondary-button block-button" data-action="start-request" ${
                this.state.saving || !lifecycleButtons.canStart
                  ? "disabled"
                  : ""
              }>Mark In Progress</button>
              <button class="secondary-button block-button" data-action="complete-request" ${
                this.state.saving || !lifecycleButtons.canComplete
                  ? "disabled"
                  : ""
              }>Complete Request</button>
            </div>
            <div class="transition-list">
              <div class="subtle">Advanced transitions (may require additional fields)</div>
              ${
                transitions.length
                  ? transitions
                      .map(
                        (transition) => `
                        <button class="secondary-button block-button" data-action="transition-request" data-stage="${escapeHtml(transition.stage)}">
                          ${escapeHtml(transition.label)}
                        </button>
                      `,
                      )
                      .join("")
                  : `<div class="empty-inline">No further transitions available.</div>`
              }
            </div>
          </section>
          <section class="card side-card">
            <div class="card-header">
              <h3>Persistence</h3>
            </div>
            <div class="meta-stack">
              <div><span>Backend mode</span><strong>${escapeHtml(this.state.health?.mode || "unknown")}</strong></div>
              <div><span>Source system</span><strong>${escapeHtml(request.source.system)}</strong></div>
              <div><span>Dirty state</span><strong>${this.state.dirtyIds.has(request.id) ? "Unsaved changes" : "Saved"}</strong></div>
            </div>
          </section>
        </aside>
      </section>
    `;
  }

  renderRequestList() {
    const requests = this.filteredRequests;

    if (!requests.length) {
      return `
        <div class="list-empty">
          <h3>No matching requests</h3>
          <p>Adjust filters or create a new request.</p>
        </div>
      `;
    }

    return requests
      .map(
        (request) => `
          <button class="${
            String(request.id) === String(this.state.selectedRequestId)
              ? "request-row active"
              : "request-row"
          }" data-action="select-request" data-request-id="${escapeHtml(request.id)}">
            <div class="request-row-head">
              <strong>${escapeHtml(request.title)}</strong>
              <span class="row-stage">${escapeHtml(this.getFriendlyStageLabel(request.stage))}</span>
            </div>
            <div class="request-row-meta">
              <span>${escapeHtml(request.recordLabel || request.recordId || "Unassigned")}</span>
              <span>${escapeHtml(request.requester || request.typeCode || "No requester")}</span>
              <span>${escapeHtml(request.priority)}</span>
            </div>
            ${
              this.state.dirtyIds.has(request.id)
                ? `<div class="dirty-flag">Unsaved</div>`
                : ""
            }
          </button>
        `,
      )
      .join("");
  }

  renderCreateModal() {
    if (!this.state.createModal.open) return "";
    const draft = this.state.createModal.draft;

    return `
      <div class="modal-backdrop">
        <section class="modal-panel" role="dialog" aria-modal="true" aria-label="Create request">
          <div class="card-header">
            <h3>New Excess Land Request</h3>
          </div>
          ${
            this.state.createModal.errors.length
              ? `<div class="flash danger">${this.state.createModal.errors.map((error) => escapeHtml(error)).join("<br>")}</div>`
              : ""
          }
          <div class="detail-grid">
            <label class="field">
              <span>Request Number</span>
              <input type="text" data-create-field="requestNumber" value="${escapeHtml(draft.requestNumber)}">
            </label>
            <label class="field span-2">
              <span>Title *</span>
              <input type="text" data-create-field="title" value="${escapeHtml(draft.title)}">
            </label>
            <label class="field">
              <span>Requester *</span>
              <input type="text" data-create-field="requester" value="${escapeHtml(draft.requester)}">
            </label>
            <label class="field">
              <span>Assigned To</span>
              <input type="text" data-create-field="assignedTo" value="${escapeHtml(draft.assignedTo)}">
            </label>
            <label class="field">
              <span>Record Id</span>
              <input type="text" data-create-field="recordId" value="${escapeHtml(draft.recordId)}">
            </label>
            <label class="field">
              <span>Record Label</span>
              <input type="text" data-create-field="recordLabel" value="${escapeHtml(draft.recordLabel)}">
            </label>
            <label class="field">
              <span>District</span>
              <input type="text" data-create-field="district" value="${escapeHtml(draft.district)}">
            </label>
            <label class="field">
              <span>County</span>
              <input type="text" data-create-field="county" value="${escapeHtml(draft.county)}">
            </label>
            <label class="field">
              <span>Location</span>
              <input type="text" data-create-field="location" value="${escapeHtml(draft.location)}">
            </label>
            <label class="field">
              <span>Parcel</span>
              <input type="text" data-create-field="parcel" value="${escapeHtml(draft.parcel)}">
            </label>
            <label class="field">
              <span>EA</span>
              <input type="text" data-create-field="ea" value="${escapeHtml(draft.ea)}">
            </label>
            <label class="field">
              <span>Route/PM</span>
              <input type="text" data-create-field="route" value="${escapeHtml(draft.route)}">
            </label>
            <label class="field">
              <span>Priority</span>
              <select data-create-field="priority">
                ${optionMarkup(
                  [
                    { value: "low", label: "Low" },
                    { value: "medium", label: "Medium" },
                    { value: "high", label: "High" },
                  ],
                  draft.priority,
                )}
              </select>
            </label>
            <label class="field span-2">
              <span>Description</span>
              <textarea rows="3" data-create-field="description">${escapeHtml(draft.description)}</textarea>
            </label>
          </div>
          <div class="modal-actions">
            <button class="secondary-button" data-action="create-request-cancel">Cancel</button>
            <button class="primary-button" data-action="create-request-submit">Create Request</button>
          </div>
        </section>
      </div>
    `;
  }

  render() {
    const totalRequests = this.state.requests.length;
    const waitingCount = this.state.requests.filter(
      (request) => request.stage === STAGES.WAITING_RESPONSE,
    ).length;
    const doneCount = this.state.requests.filter((request) =>
      [STAGES.APPROVED, STAGES.COMPLETED, STAGES.CLOSED].includes(
        request.stage,
      ),
    ).length;
    const needsActionCount = this.state.requests.filter((request) =>
      [
        STAGES.DRAFT,
        STAGES.DETAILS_IN_PROGRESS,
        STAGES.RESPONSE_RECEIVED,
      ].includes(request.stage),
    ).length;

    this.root.innerHTML = `
      <div class="shell">
        <aside class="shell-nav">
          <div class="brand">
            <div class="brand-mark">EL</div>
            <div>
              <div class="eyebrow">ExcessLand</div>
              <h1>Operations App</h1>
            </div>
          </div>
          <nav class="module-nav">
            ${[
              { key: "requests", label: "Requests", status: "Live" },
              { key: "records", label: "Records", status: "Planned" },
              { key: "activity", label: "Activity", status: "Planned" },
              { key: "settings", label: "Settings", status: "Planned" },
            ]
              .map(
                (module) => `
                  <button class="${
                    this.state.activeModule === module.key
                      ? "module-button active"
                      : "module-button"
                  }" data-action="module" data-module="${module.key}">
                    <span>${module.label}</span>
                    <small>${module.status}</small>
                  </button>
                `,
              )
              .join("")}
          </nav>
          <div class="diagnostic-card">
            <div class="eyebrow">Runtime</div>
            <strong>${escapeHtml(this.state.health?.mode || "loading")}</strong>
            <p>Frontend only talks to backend APIs. FileMaker transport stays server-side.</p>
          </div>
        </aside>
        <main class="shell-main">
          <header class="topbar">
            <div>
              <div class="eyebrow">Current Priority</div>
              <h2>Request module migration</h2>
            </div>
            <div class="topbar-actions">
              <div class="pill">${totalRequests} requests</div>
              <button class="primary-button" data-action="new-request">New request</button>
            </div>
          </header>
          ${
            this.state.flash
              ? `<div class="flash ${escapeHtml(this.state.flash.tone)}">${escapeHtml(
                  this.state.flash.message,
                )}</div>`
              : ""
          }
          <section class="summary-grid">
            <article class="summary-card">
              <span>Total requests</span>
              <strong>${totalRequests}</strong>
            </article>
            <article class="summary-card">
              <span>Needs action</span>
              <strong>${needsActionCount}</strong>
            </article>
            <article class="summary-card">
              <span>Waiting response</span>
              <strong>${waitingCount}</strong>
            </article>
            <article class="summary-card">
              <span>Done or approved</span>
              <strong>${doneCount}</strong>
            </article>
          </section>
          ${
            this.state.activeModule !== "requests"
              ? `
                <section class="workspace-empty">
                  <h2>${escapeHtml(
                    this.state.activeModule.charAt(0).toUpperCase() +
                      this.state.activeModule.slice(1),
                  )} module is reserved for the next migration slice</h2>
                  <p>The app shell already supports multi-module navigation, but this implementation only hardens Requests first.</p>
                </section>
              `
              : `
                <section class="request-shell">
                  <aside class="request-list-pane">
                    <div class="request-list-toolbar">
                      <input type="search" placeholder="Search title, record, or id" data-filter="query" value="${escapeHtml(this.state.filters.query)}">
                      <select data-filter="parentRecordId">
                        ${optionMarkup(
                          [
                            { value: "", label: "All parents" },
                            ...this.state.parents.map((parent) => ({
                              value: parent.recordId,
                              label: `${parent.recordLabel} (${parent.activeCount}/${parent.totalCount})`,
                            })),
                          ],
                          this.state.filters.parentRecordId,
                          "All parents",
                        )}
                      </select>
                      <select data-filter="stage">
                        ${optionMarkup(
                          [
                            { value: "", label: "All stages" },
                            ...Object.values(STAGES).map((stage) => ({
                              value: stage,
                              label: humanizeStage(stage),
                            })),
                          ],
                          this.state.filters.stage,
                          "All stages",
                        )}
                      </select>
                      <select data-filter="typeCode">
                        ${optionMarkup(
                          [
                            { value: "", label: "All request types" },
                            ...REQUEST_TYPES,
                          ],
                          this.state.filters.typeCode,
                          "All request types",
                        )}
                      </select>
                      <label class="field-inline">
                        <input type="checkbox" data-filter="activeOnly" ${this.state.filters.activeOnly ? "checked" : ""}>
                        <span>Active only</span>
                      </label>
                    </div>
                    <div class="request-list">${this.state.loading ? `<div class="list-empty">Loading requests...</div>` : this.renderRequestList()}</div>
                  </aside>
                  <section class="request-workspace">
                    ${this.renderDetailsPane()}
                  </section>
                </section>
              `
          }
        </main>
      </div>
      ${this.renderCreateModal()}
    `;
  }
}

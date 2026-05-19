export const RECIPIENT_OPTIONS = [
  {
    id: "recipient_environmental",
    label: "Environmental Unit",
    email: "environmental.unit@example.gov"
  },
  {
    id: "recipient_traffic",
    label: "Traffic Engineering",
    email: "traffic.engineering@example.gov"
  },
  {
    id: "recipient_right_of_way",
    label: "Right of Way",
    email: "row.requests@example.gov"
  },
  {
    id: "recipient_external",
    label: "External Agency",
    email: ""
  }
];

export const REPORTING_CODE_OPTIONS = [
  { id: "reporting_rw_01", label: "RW-01" },
  { id: "reporting_clearance_03", label: "CLR-03" },
  { id: "reporting_appraisal_07", label: "APR-07" }
];

export const REQUEST_TYPES = [
  {
    code: "CLEARANCE",
    label: "Clearance",
    subTypes: [
      { code: "CLEARANCE_DISPOSAL", label: "Disposal Clearance" },
      { code: "CLEARANCE_ENVIRONMENTAL", label: "Environmental Clearance" }
    ],
    sections: [
      {
        id: "clearanceRequest",
        title: "Request Details",
        fields: [
          { key: "sentOn", label: "Sent On", component: "date" },
          {
            key: "clearanceScope",
            label: "Clearance Scope",
            component: "select",
            options: [
              { value: "full", label: "Full" },
              { value: "partial", label: "Partial" },
              { value: "conditional", label: "Conditional" }
            ]
          },
          { key: "mapList", label: "Map List", component: "textarea" },
          { key: "comments", label: "Comments", component: "textarea" }
        ]
      },
      {
        id: "clearanceResponse",
        title: "Response",
        fields: [
          { key: "receivedOn", label: "Received On", component: "date" },
          { key: "completedOn", label: "Completed On", component: "date" },
          {
            key: "clearanceDecision",
            label: "Decision",
            component: "select",
            options: [
              { value: "approved", label: "Approved" },
              { value: "denied", label: "Denied" },
              { value: "hold", label: "On Hold" }
            ]
          }
        ]
      }
    ]
  },
  {
    code: "RWE",
    label: "RWE",
    subTypes: [
      { code: "RWE_STANDARD", label: "Standard" },
      { code: "RWE_SITE_VISIT", label: "Field Visit Required" }
    ],
    sections: [
      {
        id: "rweRequest",
        title: "Request Details",
        fields: [
          { key: "typeOfDeed", label: "Type of Deed", component: "text" },
          { key: "mapNo", label: "Map No", component: "text" },
          { key: "acknowledgment", label: "Acknowledgment", component: "text" },
          {
            key: "disposalMethod",
            label: "Disposal Method",
            component: "select",
            options: [
              { value: "direct-sale", label: "Direct Sale" },
              { value: "public-auction", label: "Public Auction" },
              { value: "exchange", label: "Exchange" }
            ]
          },
          {
            key: "optionalConditionsYears",
            label: "Optional Conditions / Years",
            component: "text"
          },
          { key: "mapAttachmentFlags", label: "Map Attachments", component: "tags" },
          { key: "notes", label: "Notes", component: "textarea" }
        ]
      },
      {
        id: "rweResponse",
        title: "Response",
        fields: [
          { key: "dateReceived", label: "Date Received", component: "date" },
          {
            key: "rweDecision",
            label: "Decision",
            component: "select",
            options: [
              { value: "approved", label: "Approved" },
              { value: "denied", label: "Denied" },
              { value: "hold", label: "On Hold" }
            ]
          }
        ]
      }
    ]
  },
  {
    code: "APPRAISAL",
    label: "Appraisal",
    subTypes: [
      { code: "APPRAISAL_REQUEST", label: "Appraisal Request" },
      { code: "APPRAISAL_REVIEW", label: "Review Request" }
    ],
    sections: [
      {
        id: "appraisalRequest",
        title: "Request Details",
        fields: [
          {
            key: "saleType",
            label: "Sale Type",
            component: "select",
            options: [
              { value: "public-auction", label: "Public Auction" },
              { value: "direct-sale", label: "Direct Sale" },
              { value: "negotiated", label: "Negotiated" }
            ]
          },
          {
            key: "appraisalType",
            label: "Appraisal Type",
            component: "select",
            options: [
              { value: "desk", label: "Desk Appraisal" },
              { value: "field", label: "Field Appraisal" },
              { value: "review", label: "Review" }
            ]
          },
          { key: "attachmentOptions", label: "Attachments", component: "tags" },
          { key: "appraisalRequestNotes", label: "Request Notes", component: "textarea" }
        ]
      },
      {
        id: "appraisalResponse",
        title: "Response",
        fields: [
          { key: "appraisalValue", label: "Appraisal Value", component: "currency" },
          { key: "completedOn", label: "Completed On", component: "date" },
          { key: "appraisalBy", label: "Appraisal By", component: "text" }
        ]
      }
    ]
  }
];

export function getRequestTypeByCode(typeCode) {
  return REQUEST_TYPES.find((type) => type.code === typeCode) || null;
}

export function getSubTypes(typeCode) {
  return getRequestTypeByCode(typeCode)?.subTypes ?? [];
}

export function getRecipientById(recipientId) {
  return RECIPIENT_OPTIONS.find((option) => option.id === recipientId) || null;
}

export function getReportingCodeById(reportingCodeId) {
  return REPORTING_CODE_OPTIONS.find((option) => option.id === reportingCodeId) || null;
}

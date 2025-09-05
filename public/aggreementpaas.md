**PLATFORM-AS-A-SERVICE AGREEMENT**  
This Platform-as-a-Service Agreement (“Agreement”) is entered into on this \_\_\_ day of  \_\_\_\_\_​,  \_\_\_\_\_​ (the “Effective Date”) between Hopsworks AB (“Company”), and \_\_\_\_\_\_\_\_\_\_\_\_\_\_        \_\_\_\_\_\_\_ “Customer”.

1. **CERTAIN DEFINITIONS**

Certain terms not defined elsewhere in the Agreement are defined below in this Section 1\.

1.1 “Acceptable Use Policy” means the acceptable use policy governing the Services, made available at [www.hopsworks.ai/ aup](http://www.hopsworks.ai/%20aup%20) (or such other location as Company may provide, as may be updated from time to time).

1.2 “Applicable Data Protection Laws” means all worldwide data protection and privacy laws applicable to the processing of the Personal Data in question, including without limitation to the extent applicable, those of the United States, the European Economic Area (including the European Union and their member states, Switzerland, and the United Kingdom) (“EEA”), Canada, Australia, Japan, and Singapore.

1.12 “HIPAA” means the Health Insurance Portability and Accountability Act of 1996, as amended and supplemented from time-to-time.

1.13 “PCI-DSS” means the Payment Card Industry Data Security Standard.

1.14 “Personal Data” shall have the meaning given to such term (or substantively equivalent term) under the Applicable Data Protection Laws.

1.15 “PHI” means health information regulated by HIPAA or by any similar privacy law governing the use of or access to health information.

1.16 “System” means any application, computing or storage device, or network.

1.3 “BAA” means a business associate agreement as defined by HIPAA (or substantively similar agreement if Customer is not in the United States and/or are not regulated by HIPAA), governing the parties’ respective obligations with respect to any PHI that may be contained within Customer Content.

1.4 “Beta Service” means any Service (or functionality of a Service) that is clearly designated as “beta”, “experimental”, “preview” or similarly identified, that is provided prior to general commercial release, and that Company at its sole discretion offers to Customer, and Customer at its sole discretion elects to use.

1.5 “Cloud Environment” means the cloud environment provided by the Cloud Provider into which Company deploys the Hopsworks.ai Control and Data Planes.

1.6 “Cloud Provider” means, unless specified otherwise in an Order Form, Amazon Web Services.

1.7 “Customer Content” means all Customer Data, Customer Metadata, and Customer Derived Data.

1.17 “Hopsworks.ai Control and Data Planes” means the elements of the Services residing within Cloud Provider account, including without limitation the user interface of the Services. In a SaaS Deployment, ​the Hopsworks.ai Control and Data Planes run in a Cloud Provider account owned by Company. In an Enterprise SaaS Deployment, the Hopsworks.ai Control and Data Planes are split such that the control plane resides in a Cloud Provider account managed by Company and the data plane resides in a Cloud Provider account managed by Customer. In a VPC Deployment, the Hopsworks.ai Control and Data Planes run in a Cloud Provider account owned by Customer. The primary processing of Customer Data by the Services occurs within the Hopsworks.ai Control and Data Planes. D​epending on the deployment configuration selected, this activity may result in fees being charged to Customer by Cloud Provider, including processing and storage costs.

2. **SERVICES AND SUPPORT**

2.1 Subject to the terms of this Agreement and any applicable order form agreed upon by Company and Customer (“Order Form”), Company will use commercially reasonable efforts to provide Customer the Company’s platform-as-a-service 

1.8 “Customer Data” means the data, other than Customer Metadata, made available by Customer for processing by, or use within, the Services.

1.9 “Customer Derived Data” means any output Customer generates from its use of the Services.  
offering in accordance with the Service Level Agreement attached hereto as Exhibit A. As part of its offering, Company provides its Technology (as defined below) for the purpose of developing and using machine learning features and applications (the “Services”) solely for Customer’s internal business purposes, unless any other permitted use is set forth 

1.10 “Customer Metadata” means information other than Customer Data that Customer inputs into the Services to direct how the Services process Customer Data, including without limitation the code and any libraries (including third party libraries) Customer utilizes within the Services.

1.11 “DPA” means the Company Data Processing Addendum applicable to Customers, available on the Effective Date at [​www.hopsworks.ai/dpa](https://www.hopsworks.ai/dpa)​.

in any applicable Order Form. Company reserves the right to improve or otherwise modify its internal System architecture at any time subject to maintaining appropriate industry standards of practice relating to the provision and security of the Services, and provided that any such modification does not materially diminish the core functionality of the Services.

2.2 Subject to the terms hereof and of any applicable Order Form, Company will provide Customer with reasonable technical support services in accordance with Company’s standard practice.  
2.3 In consideration of the provision of Services by Company and the rights granted to Customer during the Pilot Period (as defined below), if any, under this Agreement, Customer shall pay Company a fixed fee as set forth on an Order Form, subject to the terms of Section 5 herein; provided, however, that in consideration of any Services provided and rights granted by Company to Customer after the Pilot Period, a separate fee shall be mutually agreed upon by Company and Customer pursuant to an Order Form.

2.4 The initial service term (“Initial Service Term”) shall be the duration of the Pilot Period, if any, plus that additional period of time (if any), mutually agreed upon by Company and Customer pursuant to an Order Form.

2.5 Notwithstanding anything else in this Agreement, during the Pilot Period, the Services are provided “AS IS” and no warranty obligations of Company will apply. The “Pilot Period” shall be the period specified on an Order Form (subject to earlier termination as provided in this Agreement); provided, however, that subject to Company’s consent, the Pilot Period may be extended beyond such period for a separate fee mutually agreed upon by Company and Customer. For sake of clarity, Company and Customer agree that the Pilot Period may include time during which Company will deploy and integrate its Technology to the Cloud Environment.

3. **RESTRICTIONS AND RESPONSIBILITIES**

3.1 Customer acknowledges that the Services are implemented in a manner that may divide the Services between the ​Cloud Provider accounts owned or managed by either party, and that accordingly each party must undertake certain technical and organizational measures in order to protect the Services and the Customer Content. Without limiting the foregoing, 

​Customer acknowledges and agrees that, depending on the deployment configuration, (i) in order to utilize the Services, Customer may be required to have an account with Cloud Provider; (ii) Company might not host the Cloud Environment into which the Services are deployed or the Systems in which Customer Data may be stored (e.g., an AWS S3 bucket);

(iii) while certain Customer Data ​may occasionally be present within the Services (e.g., within the Customer Derived Data), the Services are not designed to archive or replicate Customer 

​Data, but merely to provide an environment to facilitate Customer’s processing of Customer

Data ​within the Cloud Environment by permitting Customer to generate and execute Customer Metadata and view Customer Derived Data; and (iv) Company and the Services do not provide backup services or disaster recovery to enable recovery of Customer Data. Accordingly, and without limiting the foregoing, but subject to Section 8, Company is not responsible for any loss, destruction, alteration, or corruption of Customer Content, except to the extent caused by the gross negligence or willful misconduct of Company.

3.2 Customer gives Company permission to access the Cloud Environment during the Term only in connection with the Services.

3.3	Customer will not violate the Acceptable Use Policy.

3.4 Customer will not ​use the Services to develop or offer a service made available to any third party that could reasonably be seen to serve as a substitute for such third party’s possible subscription to any Company product or service;

3.5 If Customer elects to receive any Beta Services offered by Company, Customer agrees that, in addition to adhering to all other restrictions generally applicable to Customer’s use of the Services under this Agreement and any requirements set forth by Company in writing regarding the particular Beta Services, Customer shall not use such Beta Services for production workloads or for any mission critical work, and that Customer shall not use sensitive data (e.g., PHI or Cardholder Data) in conjunction with such Beta Services unless explicitly permitted in an Order Form.

3.6 Customer will not, directly or indirectly: reverse engineer, decompile, disassemble or otherwise attempt to discover the source code, object code or underlying structure, ideas, know-how or algorithms relevant to the Services or any software, cloud platform, documentation or data related to the Services (“Technology”); modify, translate, or create derivative works based on the Services or any Technology (except to the extent expressly permitted by Company or authorized within the Services); use the Services or any Technology for timesharing or service bureau purposes or otherwise for the benefit of a third party; or remove any proprietary notices or labels.

3.7 Further, Customer may not remove or export from the United States or allow the export or re-export of the Services, Technology or anything related thereto, or any direct product thereof in violation of any restrictions, laws or regulations of the United States Department of Commerce, the United States Department of Treasury Office of Foreign Assets Control, or any other United States or foreign agency or authority. As defined in FAR section 2.101, the Technology and documentation are “commercial items” and according to DFAR section 252.227​**‑**7014(a)(1)**​** and (5) are deemed to be “commercial computer software” and “commercial computer software documentation.” Consistent with DFAR section 227.7202 and FAR section 12.212, any use modification, reproduction, release, performance, display, or disclosure of such commercial software or commercial software documentation by the U.S. Government will be governed solely by the terms of this Agreement and will be prohibited except to the extent expressly permitted by the terms of this Agreement.

3.8 Customer represents, covenants, and warrants that Customer will use the Services only in compliance with Company’s standard policies then in effect and all applicable laws and regulations, including without limitation any Applicable Data Protection Laws, and that, without limiting the foregoing, Customer Data and Customer Metadata shall not contain: (i) any data for which Customer does not have all rights, power and authority necessary for its collection, use and processing as contemplated by this Agreement; (ii) any  
data with respect to which Customer’s use and provision to Company pursuant to this Agreement would breach any agreement between Customer and any third party; or (iii) any data with respect to which its usage as contemplated herein would violate any applicable laws, including without limitation any Applicable Data Protection Laws. Customer hereby agrees to indemnify and hold harmless Company against any damages, losses, liabilities, settlements and expenses (including without limitation costs and attorneys’ fees) in connection with any claim or action that arises from

(a) an alleged violation of the foregoing, or   
(b) Customer’s use of Services.

3.9 Company may prohibit any use of the Services it believes may be (or alleged to be) in violation of Section 3.8.

3.10 Customer shall be responsible for obtaining and maintaining any equipment and ancillary services needed to connect to, access, or otherwise use the Services, including, without limitation, modems, hardware, servers, software, operating systems, networking, web servers and the like

(collectively, “Equipment”). Customer shall also be responsible for maintaining the security of the Equipment, Customer account, passwords (including but not limited to administrative and user passwords) and files, and for all uses of Customer account or the Equipment with or without Customer’s knowledge or consent.

3.11 The terms of the DPA applicable to customers of Company are hereby incorporated by reference and shall apply to the extent Customer Data includes Personal Data. To the extent Personal Data from the EEA is processed by Company, the Standard Contractual Clauses shall apply, as further set forth in the DPA. Where the Standard Contractual Clauses are applicable according to the DPA, Customer and its applicable affiliates are each the data exporter, and Customer’s acceptance of this Agreement shall be treated as its execution of the Standard Contractual Clauses and Appendices.

3.12 Customer agrees that it may not include in Customer Data or Customer Metadata, or generate any Customer Derived Data that includes, any PHI unless Customer has entered into (i) an Order Form that explicitly permits Customer to process PHI within the Services, and then only with respect to the deployment(s) identified in such Order Form (the “PHI Permitted Deployments”); and (ii) a BAA with Company which, upon mutual execution, shall be incorporated by reference into and subject to this Agreement. If Customer has not entered into a BAA with Company or if Customer provides PHI to Company other than through the PHI Permitted Deployments, Company will have no liability under this Agreement relating to PHI, notwithstanding anything in this Agreement or in HIPAA or any similar laws to the contrary.

3.13 Cardholder Data Under PCI-DSS. Customer agrees that it may not include in Customer Data or Customer Metadata, or generate any Customer Derived Data that includes, any cardholder data as defined under PCI-DSS (“Cardholder Data”) unless Customer has entered into an Order Form that explicitly permits Company to process

Cardholder Data within the Services (including specifying the types and quantities of such data) and, then only with respect to the deployment(s) identified in such Order Form (the “PCI Permitted Deployments”). If Customer has not entered into such mutually executed Order Form with Company, or if Customer provides Cardholder Data to Company other than through the PCI Permitted Deployments, Company will have no liability under this Agreement relating to Cardholder Data, notwithstanding anything in this Agreement or in PCI-DSS or any similar regulations to the contrary.

4. **CONFIDENTIALITY; PROPRIETARY RIGHTS**

4.1 Each party (the “Receiving Party”) understands that the other party (the “Disclosing Party”) has disclosed or may disclose business, technical or financial information relating to the Disclosing Party’s business (hereinafter referred to as “Proprietary Information” of the Disclosing Party). Proprietary Information of Company includes non-public information regarding features, functionality and performance of the Service. The Receiving Party agrees: (i) to take reasonable precautions to protect such Proprietary Information, and (ii) not to use (except in performance of the Services or as otherwise permitted herein) or divulge to any third person any such Proprietary Information. The Disclosing Party agrees that the foregoing shall not apply with respect to any information after five (5) years following the disclosure thereof or any information that the Receiving Party can document (a) is or becomes generally available to the public, or (b) was in its possession or known by it prior to receipt from the Disclosing Party, or (c) was rightfully disclosed to it without restriction by a third party, or (d) was independently developed without use of any Proprietary Information of the Disclosing Party or (e) is required to be disclosed by law.

4.2 Customer shall own all right, title and interest in and to the Customer Data, Customer Derived Data, and subject to Company’s rights in Usage Data, Customer Metadata, and any other information or materials Customer provides to Company to enable Company to perform any of the Services, and shall have sole responsibility for the legality, reliability, integrity, accuracy, and quality of the foregoing and any machine learning models and applications developed by Customer.

4.3 Subject to Section 4.2, Company shall own and retain all right, title and interest in and to (i) the Services and Technology, all improvements, enhancements or modifications thereto, and (ii) all intellectual property rights related to any of the foregoing.

4.4 Notwithstanding anything to the contrary, Company shall have the right to collect usage data and telemetry regarding Customer’s use of the Services and such usage data may occasionally contain Customer Metadata (e.g., it may contain the queries entered by Customer) but will not contain Customer Data or Customer Derived Data (“Usage Data”), and Company will be free (during and after the Term hereof) to (i) use such information and data to improve and enhance the Services and for other development, diagnostic and corrective purposes in connection with the Services and other  
Company offerings, and (ii) disclose such data solely in aggregate or other de-identified form in connection with its business. ​Company will not share or publicly make available any Usage Data that identifies Customer, other data subjects, or customers, nor use any Usage Data in a manner that derives its value from the unique aspects of Customer Metadata. ​No rights or licenses are granted except as expressly set forth herein.

5. **PAYMENT OF FEES**

5.1 Customer will pay Company the then applicable fees described in Section 2 for the Services in accordance with the terms therein (the “Fees”). Company reserves the right to change the Fees or applicable charges and to institute new charges and Fees at the end of the Initial Service Term or

then​**‑**current**​** renewal term, upon thirty (30) days prior notice to Customer (which may be sent by email). If Customer believes that Company has billed Customer incorrectly, Customer must contact Company no later than 60 days after the closing date on the first billing statement in which the error or problem appeared, in order to receive an adjustment or credit.

5.2 Company may choose to bill through an invoice, in which case, full payment for invoices issued in any given month must be received by Company within thirty (30) days of the invoice date. Unpaid amounts are subject to a finance charge of 1.5% per month on any outstanding balance, or the maximum permitted by law, whichever is lower, plus all expenses of collection and may result in immediate termination of Service. Customer shall be responsible for all taxes associated with Services other than Swedish taxes based on Company’s net income.

6. **TERM AND TERMINATION**

6.1 Subject to earlier termination as provided below or as provided in any applicable Order Form, this Agreement is for the Initial Service Term (including the Pilot Period) as specified in Section 2.4, and shall be renewed for additional periods as set forth in one or more Order Forms (collectively, the “Term”), unless either party requests termination at least thirty (30) days prior to the end of the then-current term.

6.2 In addition to any other remedies it may have, either party may also terminate this Agreement upon thirty (30) days’ notice (or without notice in the case of nonpayment), if the other party materially breaches any of the terms or conditions of this Agreement. Customer will pay in full for the Services up to and including the last day on which the Services are provided. All sections of this Agreement which by their nature should survive termination will survive termination, including, without limitation, accrued rights to payment, confidentiality obligations, warranty disclaimers, and limitations of liability.

7. **WARRANTY AND DISCLAIMER**

Company shall use reasonable efforts consistent with prevailing industry standards to maintain the Services in a manner which minimizes errors and interruptions in the Services. Services may be temporarily unavailable for

scheduled maintenance or for unscheduled emergency maintenance, either by Company or by third-party providers, or because of other causes beyond Company’s reasonable control, but Company shall use reasonable efforts to provide advance notice in writing or by e-mail of any scheduled service disruption. HOWEVER, COMPANY DOES NOT WARRANT THAT THE SERVICES WILL BE UNINTERRUPTED OR ERROR FREE; NOR DOES IT MAKE ANY WARRANTY AS TO THE RESULTS THAT MAY BE OBTAINED FROM USE OF THE SERVICES. EXCEPT AS EXPRESSLY SET FORTH IN THIS SECTION, THE SERVICES ARE PROVIDED “AS IS” AND COMPANY DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING, BUT NOT LIMITED TO, IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE AND NON-INFRINGEMENT.

8. **LIMITATION OF LIABILITY**

NOTWITHSTANDING ANYTHING TO THE CONTRARY, EXCEPT FOR BODILY INJURY OF A PERSON, COMPANY AND ITS SUPPLIERS (INCLUDING BUT NOT LIMITED TO ALL EQUIPMENT AND TECHNOLOGY SUPPLIERS), OFFICERS, AFFILIATES,

REPRESENTATIVES, CONTRACTORS AND EMPLOYEES SHALL NOT BE RESPONSIBLE OR LIABLE WITH RESPECT TO ANY SUBJECT MATTER OF THIS AGREEMENT OR TERMS AND CONDITIONS RELATED THERETO UNDER ANY CONTRACT, NEGLIGENCE, STRICT LIABILITY OR OTHER THEORY: (A) FOR ERROR OR INTERRUPTION OF USE OR FOR LOSS OR INACCURACY OR CORRUPTION OF DATA OR COST OF PROCUREMENT OF SUBSTITUTE GOODS, SERVICES OR TECHNOLOGY OR LOSS OF BUSINESS; (B) FOR ANY INDIRECT, EXEMPLARY, INCIDENTAL, SPECIAL OR CONSEQUENTIAL DAMAGES; (C) FOR ANY MATTER BEYOND COMPANY’S REASONABLE CONTROL; OR (D) FOR ANY AMOUNTS THAT, TOGETHER WITH AMOUNTS ASSOCIATED WITH ALL OTHER CLAIMS, EXCEED THE FEES PAID BY CUSTOMER TO COMPANY FOR THE SERVICES UNDER THIS AGREEMENT IN THE 12 MONTHS PRIOR TO THE ACT THAT GAVE RISE TO THE LIABILITY, IN EACH CASE, WHETHER OR NOT COMPANY HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.

9. **INSURANCE**

Company will maintain commercially appropriate insurance coverage given the nature of the Services and Company’s obligations under this Agreement. Such insurance will be in an industry standard form and shall include commercially appropriate cyber liability insurance coverage. Upon Customer’s request, Company will provide to Customer proof evidencing Company’s insurance coverage.

10. **PUBLICITY**

10.1 Customer permits (i) Company to use Customer’s approved name and logo on Company’s website and in sales presentations and activities, marketing materials, promotional videos, and press releases identifying that Customer is a customer of Company, and (ii) the publication of a case study using Customer’s approved name and logo, provided that such case study shall be subject to approval by Customer.

10.2 Customer agrees to (i) provide a positive reference regarding Company in a reasonable number of technical or executive level reference calls with analysts, media, or prospective customers of Company, and (ii) participate in a reasonable number of joint webcasts, podcasts, and conference presentations.

11. **MISCELLANEOUS**

If any provision of this Agreement is found to be unenforceable or invalid, that provision will be limited or eliminated to the minimum extent necessary so that this Agreement will otherwise remain in full force and effect and enforceable. This Agreement is not assignable, transferable or sublicensable by Customer except with Company’s prior written consent. Company may transfer and assign any of its

rights and obligations under this Agreement without consent. This Agreement is the complete and exclusive statement of the mutual understanding of the parties and supersedes and cancels all previous written and oral agreements, communications and other understandings relating to the subject matter of this Agreement, and all waivers and modifications must be in a writing signed by both parties, except as otherwise provided herein. No agency, partnership, joint venture, or employment is created as a result of this Agreement and Customer does not have any authority of any kind to bind Company in any respect whatsoever. In any action or proceeding to enforce rights under this Agreement, the prevailing party will be entitled to recover costs and attorneys’ fees. All notices under this Agreement will be in writing and will be deemed to have been duly given when received, if personally delivered; when receipt is electronically confirmed, if transmitted by facsimile or e-mail; the day after it is sent, if sent for next day delivery by recognized overnight delivery service; and upon receipt, if sent by certified or registered mail, return receipt requested. This Agreement shall be governed by the laws of the State of California without regard to its conflict of laws provisions.

**ACCEPTED AND AGREED**

| Hopsworks AB | Customer |
| :---- | :---- |
|  |  |
| Signature: | Signature: |
|  |  |
| Name: | Name: |
|  |  |
| Title: | Title: |
|  |  |

**EXHIBIT A**

**Service Level Agreement (“SLA”)**

This SLA details the service level objectives (“SLOs”) for the Feature Server that Company commits to upholding. The SLA covers Reliability based on service level indicators (“SLIs”) described below. The indicators are determined by Company on the server side. Notwithstanding anything else in the Platform-as-a-Service Agreement (the “Agreement”) or this SLA, the fee credits described in this SLA cannot be accrued during the Pilot Period. Any capitalized term used but not defined in this SLA shall have the meaning assigned to such term in the Agreement or the deployment documentation provided by Company (“Deployment Documentation”).

Reliability

The SLI for reliability is the percentage of requests which do not return a server error (HTTP 5xx). For the purpose of this indicator, client errors (HTTP 4xx) are not considered errors. Additionally, requests which time out on the server side and return 504 do not count against the reliability SLIs.

The objective for this indicator is 99.5%, measured monthly, excluding holidays and weekends and scheduled maintenance. If Customer requests maintenance during these hours, any such calculation will exclude periods affected by such maintenance. Further, any downtime resulting from outages of third party connections or utilities or other reasons beyond Company’s control will also be excluded from any such calculation. Customer’s sole and exclusive remedy, and Company’s entire liability, in connection with Service availability shall be that for each period of downtime lasting longer than one hour, Company will credit Customer 5% of monthly usage charges for the previous month for each period of 30 or more consecutive minutes of downtime; provided that no more than one such credit will accrue per day. Downtime shall begin to accrue as soon as Customer (with notice to Company) recognizes that downtime is taking place, and continues until the availability of the Services is restored. In order to receive downtime credit, Customer must notify Company in writing within 24 hours from the time of downtime, and failure to provide such notice will forfeit the right to receive downtime credit. Such credits may not be redeemed for cash and shall not be cumulative beyond a total of credits for 20% of the most recent service credit purchase in any one (1) calendar month in any event. Company will only apply a credit for any particular month at the time Customer makes a payment to Company pursuant to an Order Form after the Effective Date. Company’s blocking of data communications or other Services in accordance with its policies shall not be deemed to be a failure of Company to provide adequate service levels under the Agreement.

SLO Violations

If Customer detects what appears to be a SLO violation which is not reflected in the SLO indicator in the Web UI, a Company engineer will respond to service requests within 8 hours, during business hours.
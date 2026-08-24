# AES60_EBUtech3293v1_8.pdf

- **Source File**: `AES60_EBUtech3293v1_8.pdf`
- **File Size**: 1274232 bytes (1244.37 KB)
- **Format**: .PDF

---

## Summary & Content Preview

```text
TECH 3293

EBU CORE METADATA SET

(EBUCore)

SPECIFICATION v. 1.8

Source: MIM

Geneva

October 2017

This page and others in the document are intentionally left blank to maintain pagination for two sided printing

2

AES60, EBU Tech 3293 v.1.8

EBU Core Metadata Set

Introduction

The core set of metadata presented in this specification is a co-publication of EBU Tech3293 v. 1.8

EBU Core

EBUCore has been designed to describe audio, video and other resources for a wide range of

broadcasting applications including archives, exchange and production in the context of a Service

Oriented Architecture. EBUCore is based on the Dublin Core to maximize interoperability with the

community of Dublin Core users such as the European Digital Library 'Europeana'.

EBUCore 1.8 takes into account latest developments in the Semantic Web and Linked Open Data

communities. A link to EBUCore RDF ontology and its documentation is provided in the "download

zone". The EBUCore RDF ontology has been updated to match EBU's CCDM (Tech 3351) needs and

improve mapping with other ontologies. EBUCore RDF is listed as Linked Open Vocabulary as well as

RDF-Vocab for Ruby developers.

This document has one of its roots in the AES project X098A where the concept of providing a core

administrative metadata set for audio exchange explored. This metadata set was based on Dublin

Core and expanded to meet the basic requirements of the audio industry. At the same time, there

was similar work covering both audio and video was carried out within the EBU. The decision was

eventually to base the AES core descriptive metadata on the EBU core and co-publish this under the

auspices of EBU and AES, which is expected to have a greater impact on the industry as a whole.

This version is an update of the original specification of AES60, and is based 100% on the EBU

specification thus securing total compatibility between AES60 and EBU Core

What's new in EBUCore 1.8?

EBUCore 1.8 provides a solution for dynamic acquisition metadata, a unique representation of the

ITU-R BS.2076 Audio Data Model (ADM). Now 'props', 'costumes', 'timed text, ''actions and ''emotions'

(among others) can be associated to scenes and persons or character. High Dynmamic Range static

technical metadata and Virtual Reality flags has been added to the videoFormat element.

This document provides links to the EBUCore schema and its HTML documentation. It also provides

guidelines on how to use EBUCore to implement a variety of features.

More information on EBU metadata activities is provided on the EBU TECHNICAL website

(http://tech.ebu.ch/metadata).

3

AES60, EBU Tech 3293 v.1.8

EBU Core Metadata Set

Terms and Conditions of Use

This EBUCore is freely available for all to use, but you should take note of the following:

© EBU 2017.

REDISTRIBUTION AND USE OF THIS SPECIFICATION AND ASSOCIATED RESOURCES IS PERMITTED PROVIDED THAT

THE FOLLOWING CONDITIONS ARE MET:

REDISTRIBUTIONS MUST RETAIN THE ABOVE COPYRIGHT NOTICE, THIS LIST OF CONDITIONS AND THE

FOLLOWING DISCLAIMER IN THE DOCUMENTATION AND/OR OTHER MATERIALS PROVIDED WITH THE

DISTRIBUTION;

NEITHER THE NAME OF THE EBU NOR THE NAMES OF ITS CONTRIBUTOR(S) MAY BE USED TO ENDORSE OR

PROMOTE PRODUCTS DERIVED FROM THIS SPECIFICATION AND ASSOCIATED RESOURCES WITHOUT SPECIFIC

PRIOR WRITTEN PERMISSION.

DISCLAIMER: THIS SPECIFICATION AND ASSOCIATED RESOURCES IS PROVIDED BY THE COPYRIGHT OWNER "AS IS"

AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF

MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE

COPYRIGHT OWNER BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR

CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR

SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY

THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLI
```

## Full Extracted Text

TECH 3293
EBU CORE METADATA SET
(EBUCore)

SPECIFICATION v. 1.8
Source: MIM

Geneva
October 2017

This page and others in the document are intentionally left blank to maintain pagination for two sided printing

2

AES60, EBU Tech 3293 v.1.8

EBU Core Metadata Set

Introduction
The core set of metadata presented in this specification is a co-publication of EBU Tech3293 v. 1.8
EBU Core
EBUCore has been designed to describe audio, video and other resources for a wide range of
broadcasting applications including archives, exchange and production in the context of a Service
Oriented Architecture. EBUCore is based on the Dublin Core to maximize interoperability with the
community of Dublin Core users such as the European Digital Library 'Europeana'.
EBUCore 1.8 takes into account latest developments in the Semantic Web and Linked Open Data
communities. A link to EBUCore RDF ontology and its documentation is provided in the "download
zone". The EBUCore RDF ontology has been updated to match EBU's CCDM (Tech 3351) needs and
improve mapping with other ontologies. EBUCore RDF is listed as Linked Open Vocabulary as well as
RDF-Vocab for Ruby developers.
This document has one of its roots in the AES project X098A where the concept of providing a core
administrative metadata set for audio exchange explored. This metadata set was based on Dublin
Core and expanded to meet the basic requirements of the audio industry. At the same time, there
was similar work covering both audio and video was carried out within the EBU. The decision was
eventually to base the AES core descriptive metadata on the EBU core and co-publish this under the
auspices of EBU and AES, which is expected to have a greater impact on the industry as a whole.
This version is an update of the original specification of AES60, and is based 100% on the EBU
specification thus securing total compatibility between AES60 and EBU Core
What's new in EBUCore 1.8?
EBUCore 1.8 provides a solution for dynamic acquisition metadata, a unique representation of the
ITU-R BS.2076 Audio Data Model (ADM). Now 'props', 'costumes', 'timed text, ''actions and ''emotions'
(among others) can be associated to scenes and persons or character. High Dynmamic Range static
technical metadata and Virtual Reality flags has been added to the videoFormat element.
This document provides links to the EBUCore schema and its HTML documentation. It also provides
guidelines on how to use EBUCore to implement a variety of features.
More information on EBU metadata activities is provided on the EBU TECHNICAL website
(http://tech.ebu.ch/metadata).

3

AES60, EBU Tech 3293 v.1.8

EBU Core Metadata Set

Terms and Conditions of Use
This EBUCore is freely available for all to use, but you should take note of the following:
© EBU 2017.
REDISTRIBUTION AND USE OF THIS SPECIFICATION AND ASSOCIATED RESOURCES IS PERMITTED PROVIDED THAT
THE FOLLOWING CONDITIONS ARE MET:
REDISTRIBUTIONS MUST RETAIN THE ABOVE COPYRIGHT NOTICE, THIS LIST OF CONDITIONS AND THE
FOLLOWING DISCLAIMER IN THE DOCUMENTATION AND/OR OTHER MATERIALS PROVIDED WITH THE
DISTRIBUTION;
NEITHER THE NAME OF THE EBU NOR THE NAMES OF ITS CONTRIBUTOR(S) MAY BE USED TO ENDORSE OR
PROMOTE PRODUCTS DERIVED FROM THIS SPECIFICATION AND ASSOCIATED RESOURCES WITHOUT SPECIFIC
PRIOR WRITTEN PERMISSION.
DISCLAIMER: THIS SPECIFICATION AND ASSOCIATED RESOURCES IS PROVIDED BY THE COPYRIGHT OWNER "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE
COPYRIGHT OWNER BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR
OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS [SOFTWARE], EVEN IF ADVISED OF THE POSSIBILITY
OF SUCH DAMAGE.

An AES standard implies a consensus of those directly and materially affected by its scope and provisions and is intended as
a guide to aid the manufacturer, the consumer, and the general public. The existence of an AES standard does not in any
respect preclude anyone, whether or not he or she has approved the document, from manufacturing, marketing, purchasing,
or using products, processes, or procedures not in agreement with the standard. Prior to approval, all parties were provided
opportunities to comment or object to any provision. Attention is drawn to the possibility that some of the elements of this
AES standard or information document may be the subject of patent rights. AES shall not be held responsible for identifying
any or all such patents. Approval does not assume any liability to any patent owner, nor does it assume any obligation
whatever to parties adopting the standards document. This document is subject to periodic review and users are cautioned to
obtain the latest edition. Recipients of this document are invited to submit, with their comments, notification of any relevant
patent rights of which they are aware and to provide supporting documentation.

This issue published by
Audio Engineering Society, Inc.
Copyright ©2017 by the Audio Engineering Society

4

AES60, EBU Tech 3293 v.1.8

EBU Core Metadata Set

5

AES60, EBU Tech 3293 v.1.8

EBU Core Metadata Set

Contents
Introduction .............................................................................................. 3
1.

Scope ............................................................................................. 7

2.

Core Metadata Set.............................................................................. 8
2.1

Introduction ........................................................................................................ 8

2.2

Documentation .................................................................................................... 8

2.3

What is new in EBUCore 1.8 ..................................................................................... 8

2.4

Tech. 3364 - Audio Definition Model (ADM) .................................................................. 9

3.

Implementation Guidelines / Questions & Answers ....................................11
3.1

How do I express titles of a custom type in different languages?........................................ 11

3.1.1

Title ......................................................................................................................... 11

3.1.2

Alternative Title ........................................................................................................... 12

3.2

What controlled vocabularies and reference data can I use? ............................................. 12

3.3

Video and Audio time point references: anything fixed? .................................................. 13

3.4

What is the 'part' element? How can I use it? ................................................................ 14

3.4.1
3.4.2
3.4.3
3.4.4

How can I define editorial 'parts' of a media resource? ............................................................. 14
How can I use the 'part' element for dynamic (technical) metadata? ............................................. 15
How can I use parts to describe (programme) groups? .............................................................. 16
Distributed storage of media resources: where and in which format? ............................................ 16

3.4.5

Can I use the 'part' element to fragment my data? ................................................................... 17

3.4.6

Can I use the 'part' element to localise props and artefacts? ....................................................... 17

3.4.7

Can I use the 'part' element to localise agents/contributors? ...................................................... 18

3.4.8

Can I use the 'part' element to localise text? ......................................................................... 18

3.5

How can I describe versions of programmes? ................................................................ 18

3.6

How can I use my own technical attributes? ................................................................. 18

3.7

How do I apply loudness? ....................................................................................... 18

3.8

How can I tag content in EBUCore? ............................................................................ 19

3.9

How can I differentiate locators? ............................................................................. 19

3.10

How can I associate a format and rights to a publication event? ........................................ 19

3.11

When do I use labels and/or links in type/format/status ? ............................................... 19

3.12

Can I provide e.g. a display or print name in contactDetails? ............................................ 19

3.13

Can I provide contactDetails for a group or ensemble? .................................................... 19

3.14

Are there examples of implementation of the new audio model? ....................................... 20

3.15

How can I extend a schedule beyond midnight? ............................................................. 20

3.16

targetAudience, audienceLevel and audienceRating? ...................................................... 20

3.17

When should I use rating? ....................................................................................... 20

3.18

How do I provide annotation along a timeline? ............................................................. 21

3.19

How do I map mxf video and audio tracks to EBUCore?.................................................... 21

3.20

How do I map MPEG video and audio tracks to EBUCore? ................................................. 24

3.21

How do I implement EIDR or ISAN in EBUCore? .............................................................. 25

3.22

How to define a checksum for insertion in BWF chunks? .................................................. 26

3.23

How do I map EBUCore xml to EBUCore rdf? ................................................................ 26

3.24

How do I use correction factors – frame rate, timecode…? ............................................... 26

3.24.1

aspectRatioType ........................................................................................................... 26

5

AES60, EBU Tech 3293 v.1.8

EBU Core Metadata Set

3.24.2

rationalType ................................................................................................................ 27

3.24.3

EditUnitNumbertype ...................................................................................................... 27

3.24.4

timecodeType .............................................................................................................. 27

3.25

Can I represent highly dynamic metadata ? ................................................................. 27

3.26

Can I track props, costumes and other artefacts in production ? ........................................ 27

3.27

Can I represent timed text from various sources ? ......................................................... 28

3.28

Can I track emotions and actions ? ............................................................................ 28

3.29

How do I attach EBUCore side-car metadata in IMF ........................................................ 28

3.30

More questions? .................................................................................................. 28

4.

Compliance .....................................................................................28

5.

Maintenance ....................................................................................29

6.

Download Zone ................................................................................29

7.

Useful links .....................................................................................29

8.

Bibliography ....................................................................................30

Annex A: EBUCore Metadata Set Schema .........................................................31
Annex B: EBUCore and Semantic Web.............................................................33
Annex C: Applying EBU Tech 3364's data model in EBUCore .................................35
C.1

Channel based example (extract from Tech 3364) ......................................................... 35

C.2

Object based example (extract from Tech 3364) ........................................................... 37

C.3

Scene based example (extract from Tech 3364) ............................................................ 39

6

AES60, EBU Tech 3293 v.1.8

EBU Core Metadata Set

AES standard for audio metadata Core audio metadata
•
EBUCore Metadata Set
(EBUCore)
Standards
Committee
EBU MIM

First Issued

Revised

Dec. 2008

November 2017 (v.1.8)

AES SC-07-01

2011 as AES60

November 2017

Re-issued

Keywords: EBUCore, Metadata, Schema, Dublin Core, P-META, Tech 3293, Radio, Television, CCDM

1.

Scope

Metadata is essential to broadcasting.
The “EBUCore” set of metadata defined in this specification has been identified as being the
minimum information needed to describe radio and television content.

Content
Distributors

Content
Creators
B2B

B2C

Archives

Consumers

Figure 1: A basic content and metadata workflow
"If you can't find it, you don't have it!" This should not happen in modern IT-based production
environments. Metadata is the glue between production operations in particular moving towards
Service Oriented Architecture and file-based production. Documenting audiovisual resources with
EBUCore information is a minimum requirement corresponding to fundamental investment with
guaranteed return.
This specification addresses the creation, management and preservation of audiovisual material.
EBUCore facilitates programme exchanges between broadcasters or between production facilities in
distributed and cloud environments. Beyond production, EBUCore can be used to describe content
for distribution (broadcast, broadband Internet, mobile or hybrid delivery). EBUCore is also the
default set of technical and descriptive metadata used by FIMS, the Framework of Interoperable
Media Services (http://fims.tv).
The core set of metadata presented in EBUCore is the Dublin Core for media. The Dublin Core is
being used as a core metadata set by librarians and museums in cultural heritage projects. The
EBUCore is recommended when describing and providing access to audiovisual content and is not
limited to archives.
EBUCore takes into account latest developments in the Semantic Web and Linked Open Data
7

AES60, EBU Tech 3293 v.1.8

EBU Core Metad

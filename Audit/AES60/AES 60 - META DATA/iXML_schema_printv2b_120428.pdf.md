# iXML_schema_printv2b_120428.pdf

- **Source File**: `iXML_schema_printv2b_120428.pdf`
- **File Size**: 99230 bytes (96.9 KB)
- **Format**: .PDF

---

## Summary & Content Preview

```text
Z:\AES docs\SC-07-01\iXML_v2.xml

27/04/2012 16:21:19

XML

Comment

version

1.0

encoding

UTF-8

Draft of schema for iXML, provided by Tormod Værvågen, NRK, Norway:V2cjc

xs:schema

http://www.w3.org/2001/XMLSchema

xmlns:xs

xs:element

name

BWFXML

type

C_BWFXML

xs:complexType (9)

name

1 C_BWFXML

xs:sequence

xs:sequence

xs:element (17)

name

1 IXML_VERSION

minOccurs

type

minOccurs

0

xs:simpleType

xs:simpleType

xs:restriction

xs:string

base

xs:pattern

value

2 PROJECT

xs:string

0

3 SCENE

xs:string

0

4 TAKE

xs:string

0

xs:string

0

5 TAPE

6 CIRCLED

0

\d+\.\d+

xs:simpleType

xs:restriction

xs:string

base

xs:enumeration (2)

value

1 TRUE

2 FALSE

7 FILE_UID

8 UBITS

S_UID

0

0

xs:simpleType

xs:restriction

xs:string

base

xs:pattern

value

2 C_TRACK_LIST

9 NOTE

xs:string

10 SYNC_POINT_LIST

C_SYNC_POINT_LIST 0

11 SPEED

C_SPEED

0

12 HISTORY

C_HISTORY

0

13 FILE_SET

C_FILE_SET

0

14 TRACK_LIST

C_TRACK_LIST

0

15 PRE_RECORD_SAMP

LECOUNT

xs:int

0

16 BEXT

C_BEXT

0

17 USER

xs:string

0

\d{8}

0

xs:sequence
```

## Full Extracted Text

Z:\AES docs\SC-07-01\iXML_v2.xml

27/04/2012 16:21:19

XML

Comment

version

1.0

encoding

UTF-8

Draft of schema for iXML, provided by Tormod Værvågen, NRK, Norway:V2cjc

xs:schema
http://www.w3.org/2001/XMLSchema

xmlns:xs
xs:element

name

BWFXML

type

C_BWFXML

xs:complexType (9)
name
1 C_BWFXML

xs:sequence
xs:sequence
xs:element (17)
name
1 IXML_VERSION

minOccurs

type

minOccurs

0

xs:simpleType
xs:simpleType
xs:restriction
xs:string

base
xs:pattern

value
2 PROJECT

xs:string

0

3 SCENE

xs:string

0

4 TAKE

xs:string

0

xs:string

0

5 TAPE
6 CIRCLED

0

\d+\.\d+

xs:simpleType
xs:restriction
xs:string

base
xs:enumeration (2)

value
1 TRUE
2 FALSE
7 FILE_UID
8 UBITS

S_UID

0

0

xs:simpleType
xs:restriction
xs:string

base
xs:pattern

value

2 C_TRACK_LIST

9 NOTE

xs:string

10 SYNC_POINT_LIST

C_SYNC_POINT_LIST 0

11 SPEED

C_SPEED

0

12 HISTORY

C_HISTORY

0

13 FILE_SET

C_FILE_SET

0

14 TRACK_LIST

C_TRACK_LIST

0

15 PRE_RECORD_SAMP
LECOUNT

xs:int

0

16 BEXT

C_BEXT

0

17 USER

xs:string

0

\d{8}

0

xs:sequence
xs:element (2)

3 C_TRACK

name
1 TRACK_COUNT

type
xs:int

2 TRACK

C_TRACK

maxOccurs
unbounded

xs:sequence
xs:element (4)
name
1 CHANNEL_INDEX

minOccurs

type

minOccurs

0

xs:simpleType
xs:simpleType
xs:restriction
xs:int

base
xs:minInclusive

value
2 INTERLEAVE_INDEX 0

1

xs:simpleType
xs:restriction
xs:int

base
xs:minInclusive

value
3 NAME
4 FUNCTION

xs:string

1

0

0

xs:simpleType
xs:restriction
xs:string

base

xs:enumeration (30)
value
1 M-MID_SIDE
2 S-MID_SIDE
3 X-X_Y
4 Y-X_Y
5 L-MIX
6 R-MIX
7 MIX
8 LEFT
9 RIGHT
10 L-LCRS
11 C-LCRS
12 R-LCRS
13 S-LCRS
14 L-5.1
15 C-5.1
16 R-5.1
17 Ls-5.1
18 Rs-5.1
19 L-7.1
20 Lc-7.1
21 C-7.1
22 Rc-7.1
23 R-7.1
24 Ls-7.1
25 Rs-7.1
26 LFE-7.1
27 W-SOUNDFIELD
28 X-SOUNDFIELD
29 Y-SOUNDFIELD
30 Z-SOUNDFIELD
4 C_SYNC_POINT

xs:sequence
xs:element (6)
name
1 SYNC_POINT_TYPE

minOccurs

type

minOccurs

0

xs:simpleType
xs:simpleType
xs:restriction
xs:string

base
xs:enumeration (2)

value
1 RELATIVE
2 ABSOLUTE
2 SYNC_POINT_FUNCT 0
ION

xs:simpleType
xs:restriction
xs:string

base
xs:enumeration (6)

value
1 PRE_RECORD_SAMP
LECOUNT
2 SLATE_GENERIC
3 MARKER_GENERIC
4 MARKER_AUTOPLAY
5 MARKER_AUTOPLAY
STOP
6 MARKER_AUTOPLAY
LOOP

5 C_SYNC_POINT_LIST

3 SYNC_POINT_COMM
ENT

xs:string

0

4 SYNC_POINT_LOW

xs:int

0

5 SYNC_POINT_HIGH

xs:int

0

6 SYNC_POINT_EVENT
_DURATION

xs:int

0

xs:sequence
xs:element (2)
name
type
1 SYNC_POINT_COU... xs:int

6 C_SPEED

maxOccurs

2 SYNC_POINT

C_SYNC_POINT

unbounded

name
1 NOTE

type
xs:string

0

2 MASTER_SPEED

S_FRACTION

0

xs:sequence
xs:element (11)
minOccurs

3 CURRENT_SPEED

S_FRACTION

0

4 TIMECODE_RATE

S_FRACTION

0

5 TIMECODE_FLAG

0

xs:simpleType

xs:simpleType
xs:restriction
xs:string

base
xs:enumeration (2)

value
1 NDF
2 DF
6 FILE_SAMPLE_RATE xs:int

0

7 AUDIO_BIT_DEPTH

xs:int

0

8 DIGITIZER_SAMPLE_ xs:int
RATE

0

9 TIMESTAMP_SAMPL xs:int
ES_SINCE_MIDNIG...

0

10 TIMESTAMP_SAMPL xs:int
ES_SINCE_MIDNIG...

0

11 TIMESTAMP_SAMPL xs:int
E_RATE
7 C_HISTORY

xs:sequence
xs:element (3)

8 C_FILE_SET

name
type
1 ORIGINAL_FILENAME xs:string

0

2 PARENT_FILENAME

xs:string

0

3 PARENT_UID

xs:string

0

minOccurs

name
1 TOTAL_FILES

type
xs:int

2 FAMILY_UID

xs:string

3 FAMILY_NAME

xs:string

0

4 FILE_SET_INDEX

xs:string

0

name
1 BWF_DESCRIPTION

type
xs:string

2 BWF_ORIGINATOR

xs:string

xs:sequence
xs:element (4)

9 C_BEXT

minOccurs

xs:sequence
xs:element (11)

3 BWF_ORIGINATOR_R xs:string
EFERENCE
4 BWF_ORIGINATION_ xs:string
DATE
5 BWF_ORIGINATION_ xs:string
TIME
6 BWF_TIME_REFERE xs:int
NCE_LOW
7 BWF_TIME_REFERE xs:int
NCE_HIGH
8 BWF_VERSION

xs:string

9 BWF_UMID

xs:string

10 BWF_RESERVED

xs:string

11 BWF_CODING_HISTO xs:string
RY
xs:simpleType (2)
name
1 S_FRACTION

xs:restriction
xs:restriction

2 S_UID

xs:restriction

base

xs:string

xs:pattern
value
base

\d+/\d+

xs:string

xs:pattern
value

[AZ]

©1998-2010 Altova GmbH http://www.altova.com

Registered to Juliet Payne (BBC G.7, Ground)

Page 1



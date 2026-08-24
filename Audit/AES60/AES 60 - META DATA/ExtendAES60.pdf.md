# ExtendAES60.pdf

- **Source File**: `ExtendAES60.pdf`
- **File Size**: 183489 bytes (179.19 KB)
- **Format**: .PDF

---

## Summary & Content Preview

```text
AES 60 - EBU Core

Extending the Core

Tormod Værvågen, NRK Norway

From the beginning EBUCore/AES60 was

designed with the capability to extend the

core in a clear, flexible but still exact

approach. From the start XML was design

with the goal to be extensible and flexible,

and the Dublin Core heritage with its rather

vague recommendations, this was the

natural design path.

Being a core standard covering the diverse

broadcasting industry one of the most

important aspect of the standard was this

extension mechanism. Flexibility and

usefulness should go hand in hand. The

most common elements will be coverd by

the schema itself without any extensions,

but the extensions is always a possibility if

an application need another data field

transferred.

In several places in the EBUCore/AES60

schema you will have a set of attributes like

this:

@typeLabel

@typeLink

@typeDefinition

The purpose of those attributes is to

describe the contents, and meaning of a

given field. A standard field is reused, with a

different definition, like the example below.

In system-to-system integration the use of a

certain field can be different from one

company to another. By using a dictionary,

the usage and meaning of each field can be

described in detail.

If more fields are needed, just another entry

of the dictionary is made, describing the

<description typeLink="http://gluon.nrk.no/dataordbok.xml#description">

<dc:description>A long nice footballmatch</dc:description>

</description>

<description typeLink="http://gluon.nrk.no/dataordbok.xml#comment">

<dc:description>First half was boring, the second terible</

dc:description>

</description>

<description typeLink="http://dev.tv2.no/drDictionary.xml#editcomment">

<dc:description>Wrong colour in start of clip</dc:description>

</description>

additional filed, and the new element is added in the

instance.

Most of the schema, both descriptive and technical

metadata have the type attribute group present and

can be extended in this way, either an ad hock or on

more permanent basis for a certain usage or a

group.

The format of the xml is

described with the xml schema;

the data dictionaries will help the

partners to understand the

meaning of the xml document

forming a proper massage.

In the rare situations when a

further extension is needed you will always have

the possibility to define a new complex type,

based on one of the complex types in the

schema, ref. http://www.w3schools.com/schema/

el_redefine.asp.

During 2013 a group of audio experts have made

a new audio model that will be a part of the

technical metadata definition of the upcoming 1.5

version of EBUCore.

The model that you can se a overview of on the

right is soon ready for publishing. Focusing on

describing every audio system used in radio and

television this will be of particular interest for

AES, and will influence of the need to have other

extensions of technical metadata.
```

## Full Extracted Text

AES 60 - EBU Core

Extending the Core
Tormod Værvågen, NRK Norway

From the beginning EBUCore/AES60 was
designed with the capability to extend the
core in a clear, flexible but still exact
approach. From the start XML was design
with the goal to be extensible and flexible,
and the Dublin Core heritage with its rather
vague recommendations, this was the
natural design path.
Being a core standard covering the diverse
broadcasting industry one of the most
important aspect of the standard was this
extension mechanism. Flexibility and
usefulness should go hand in hand. The
most common elements will be coverd by
the schema itself without any extensions,
but the extensions is always a possibility if
an application need another data field
transferred.

In several places in the EBUCore/AES60
schema you will have a set of attributes like
this:
@typeLabel
@typeLink
@typeDefinition
The purpose of those attributes is to
describe the contents, and meaning of a
given field. A standard field is reused, with a
different definition, like the example below.
In system-to-system integration the use of a
certain field can be different from one
company to another. By using a dictionary,
the usage and meaning of each field can be
described in detail.
If more fields are needed, just another entry
of the dictionary is made, describing the

<description typeLink="http://gluon.nrk.no/dataordbok.xml#description">
<dc:description>A long nice footballmatch</dc:description>
</description>
<description typeLink="http://gluon.nrk.no/dataordbok.xml#comment">
<dc:description>First half was boring, the second terible</
dc:description>
</description>
<description typeLink="http://dev.tv2.no/drDictionary.xml#editcomment">
<dc:description>Wrong colour in start of clip</dc:description>
</description>

additional filed, and the new element is added in the
instance.
Most of the schema, both descriptive and technical
metadata have the type attribute group present and
can be extended in this way, either an ad hock or on
more permanent basis for a certain usage or a
group.
The format of the xml is
described with the xml schema;
the data dictionaries will help the
partners to understand the
meaning of the xml document
forming a proper massage.
In the rare situations when a
further extension is needed you will always have
the possibility to define a new complex type,
based on one of the complex types in the
schema, ref. http://www.w3schools.com/schema/
el_redefine.asp.
During 2013 a group of audio experts have made
a new audio model that will be a part of the
technical metadata definition of the upcoming 1.5
version of EBUCore.
The model that you can se a overview of on the
right is soon ready for publishing. Focusing on
describing every audio system used in radio and
television this will be of particular interest for
AES, and will influence of the need to have other
extensions of technical metadata.



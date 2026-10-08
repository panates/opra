import {
  ApiField,
  ArrayType,
  ComplexType,
  HttpController,
  HttpOperation,
  OmitType,
} from '@opra/common';
import { HttpContext, MultipartReader } from '@opra/http';

@ComplexType()
class AvatarMetadata {
  @ApiField({ required: true })
  declare name: string;
  @ApiField({ type: ArrayType(String) })
  tags?: string[];
}

@(HttpController({
  path: 'avatar',
  // Nested under the profile, so this replaces the `Account` it would
  // otherwise inherit.
  sections: ['Customers'],
}).UseType(AvatarMetadata))
export class AvatarController {
  @(HttpOperation.POST({})
    .MultipartContent({}, content => {
      content.Field('name', { type: String, required: true });
      content.Field('metadata', { type: OmitType(AvatarMetadata, ['name']) });
      content.Field('metadata2', { contentType: 'application/json' });
      content.File('image', { contentType: 'image/*', required: true });
    })
    .Response(200, { type: AvatarMetadata }))
  async update(context: HttpContext) {
    const reader = await context.getMultipartReader();
    const parts = await reader.getAll();
    const part = parts.find(
      x => x.field === 'metadata',
    ) as MultipartReader.Field;
    return part.value;
  }
}

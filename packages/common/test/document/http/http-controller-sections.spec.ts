import 'reflect-metadata';
import {
  ApiDocument,
  ApiDocumentFactory,
  HttpController,
  HttpOperation,
  OpraSchema,
} from '@opra/common';
import { expect } from 'expect';

/* A resource whose operations all belong together: said once, on the
   controller, instead of repeated on every operation. `report` is the one
   that belongs somewhere else. */
@HttpController({ sections: ['Customers'] })
class RootController {
  @HttpOperation({ method: 'GET' })
  get() {}

  @HttpOperation({ method: 'GET', sections: ['Reports'] })
  report() {}
}

/* Nested under the one above, declaring nothing of its own. */
@HttpController({ path: 'Notes' })
class InheritingController {
  @HttpOperation({ method: 'GET' })
  get() {}
}

/* Nested too, but speaking for itself. */
@HttpController({ path: 'Audit', sections: ['Admin'] })
class OverridingController {
  @HttpOperation({ method: 'GET' })
  get() {}
}

@HttpController({
  sections: ['Customers'],
  controllers: [InheritingController, OverridingController],
})
class ParentController {
  @HttpOperation({ method: 'GET' })
  get() {}
}

/* Declares nothing anywhere - the one case that must stay undefined, since
   the api's own `sections` are definitions and not a membership list. */
@HttpController({ path: 'Loose' })
class UngroupedController {
  @HttpOperation({ method: 'GET' })
  get() {}
}

describe('common:HttpController sections', () => {
  let doc: ApiDocument;

  before(async () => {
    doc = await ApiDocumentFactory.createDocument({
      spec: OpraSchema.SpecVersion,
      info: { title: 'Sections', version: 'v1' },
      api: {
        transport: 'http',
        name: 'TestService',
        sections: [{ name: 'Customers' }, { name: 'Admin' }],
        controllers: [RootController, ParentController, UngroupedController],
      },
    });
  });

  /** `Controller/Nested#operation` - controllers by NAME (what
   *  `findController` walks), which is the class name without its
   *  `Controller` suffix, not the url path. */
  function operation(path: string): HttpOperation {
    const [controllerPath, name] = path.split('#');
    return doc.httpApi!.findController(controllerPath)!.operations.get(name)!;
  }

  it("Should give an operation its controller's sections", () => {
    expect(operation('Root#get').sections).toStrictEqual(['Customers']);
  });

  it('Should let an operation name its own instead', () => {
    // Replaces the inherited list rather than adding to it.
    expect(operation('Root#report').sections).toStrictEqual(['Reports']);
  });

  it('Should pass them down to a nested controller', () => {
    expect(operation('Parent/Inheriting#get').sections).toStrictEqual([
      'Customers',
    ]);
  });

  it('Should let a nested controller override them', () => {
    expect(operation('Parent/Overriding#get').sections).toStrictEqual([
      'Admin',
    ]);
  });

  it('Should leave an operation with none at all undefined', () => {
    // The api's own `sections` are definitions, not a membership list, so
    // the walk must stop at the controller chain.
    expect(operation('Ungrouped#get').sections).toStrictEqual(undefined);
  });

  it('Should export the resolved sections, so no reader has to walk up', () => {
    const schema = doc.export() as any;
    const controllers = schema.api.controllers;
    expect(controllers.Root.sections).toStrictEqual(['Customers']);
    expect(controllers.Root.operations.get.sections).toStrictEqual([
      'Customers',
    ]);
    expect(controllers.Root.operations.report.sections).toStrictEqual([
      'Reports',
    ]);
    expect(
      controllers.Parent.controllers.Inheriting.operations.get.sections,
    ).toStrictEqual(['Customers']);
    expect(
      controllers.Parent.controllers.Overriding.operations.get.sections,
    ).toStrictEqual(['Admin']);
    expect(controllers.Ungrouped.operations.get.sections).toStrictEqual(
      undefined,
    );
  });
});

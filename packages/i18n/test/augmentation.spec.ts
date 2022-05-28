import '../src';
import i18next from 'i18next';
import path from 'path';

describe('I18next module augmentation', function () {

  beforeAll(async () => {
    i18next.registerLocaleDir(path.join(__dirname, '_support/locale'));
    await i18next.init({
      defaultNS: 'translate',
      lng: 'en',
      resources: {
        en: {
          translate: {
            'HELLO': 'Hello {{name}}',
            'ok': 'ok',
            'OK': 'OK',
          }
        },
        fr: {
          translate: {
            'HELLO': 'Bonjour {{name}}'
          }
        }
      },
      resourceDirs: [path.join(__dirname, '_support/locale2')]
    })
  });

  it('Should add "deep" method to i18next', async () => {
    expect(i18next.deep).toBeInstanceOf(Function);
  })

  it('Should translate key using "deep" method', async () => {
    expect(i18next.deep('HELLO', {name: 'John'})).toStrictEqual('Hello John');
  })

  it('Should translate text using "deep" method', async () => {
    expect(i18next.deep('$t(HELLO). How are you', {name: 'John'})).toStrictEqual('Hello John. How are you');
  })

  it('Should translate array using "deep" method', async () => {
    expect(i18next.deep(['HELLO', '$t(HELLO). How are you'], {name: 'John'}))
      .toStrictEqual(['Hello John', 'Hello John. How are you']);
  })

  it('Should translate object using "deep" method', async () => {
    expect(i18next.deep({a: 'HELLO', b: '$t(HELLO). How are you'}, {name: 'John'}))
      .toStrictEqual({a: 'Hello John', b: 'Hello John. How are you'});
  })

  it('Should handle circular referenced objects', async () => {
    const src1: any = {a: 'HELLO'};
    const src2: any = {b: '$t(HELLO). How are you'};
    src1.b = src2;
    src2.a = src1;
    const dst1: any = {a: 'Hello John'};
    const dst2: any = {b: 'Hello John. How are you'};
    dst1.b = dst2;
    dst2.a = dst1;
    expect(i18next.deep(src1, {name: 'John'}))
      .toStrictEqual(dst1);
  })

  it('Should add "lowercase" formatter', async () => {
    expect(i18next.deep('$t(OK, lowercase)')).toStrictEqual('ok');
  })

  it('Should add "uppercase" formatter', async () => {
    expect(i18next.deep('$t(ok, uppercase)')).toStrictEqual('OK');
  })

  it('Should add "upperFirst" formatter', async () => {
    expect(i18next.deep('$t(ok, upperFirst)')).toStrictEqual('Ok');
  })

  it('Should load global registered locale directories', async () => {
    await i18next.changeLanguage('tr');
    expect(i18next.t('HELLO', {name: 'John'})).toStrictEqual('Merhaba John');
  })

  it('Should load given locale directories', async () => {
    await i18next.changeLanguage('tr');
    expect(i18next.t('OK')).toStrictEqual('TAMAM');
  })

});


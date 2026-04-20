import { describe, expect, test } from "vitest";
import { extractShapesFromSlideXml, parseRelationships, parseXfrm } from "./extract-template-layout-presets";

describe("ppt-mvp extract template layout presets", () => {
  test("parses xfrm offsets and extents", () => {
    const result = parseXfrm(`
      <a:xfrm>
        <a:off x="1524000" y="1122363"/>
        <a:ext cx="9144000" cy="2387600"/>
      </a:xfrm>
    `);

    expect(result).toEqual({
      x: 1524000,
      y: 1122363,
      w: 9144000,
      h: 2387600,
    });
  });

  test("extracts text and image shapes with rel targets", () => {
    const rels = parseRelationships(`
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId4" Target="../media/image1.jpg" />
      </Relationships>
    `);

    const shapes = extractShapesFromSlideXml(`
      <p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
        <p:sp>
          <p:nvSpPr>
            <p:cNvPr id="2" name="标题 1"/>
            <p:cNvSpPr/>
            <p:nvPr><p:ph type="ctrTitle"/></p:nvPr>
          </p:nvSpPr>
          <p:spPr>
            <a:xfrm><a:off x="1524000" y="1122363"/><a:ext cx="9144000" cy="2387600"/></a:xfrm>
          </p:spPr>
          <p:txBody><a:p><a:r><a:t>部门复盘总结</a:t></a:r></a:p></p:txBody>
        </p:sp>
        <p:pic>
          <p:nvPicPr><p:cNvPr id="3" name="图片 2"/></p:nvPicPr>
          <p:blipFill><a:blip r:embed="rId4"/></p:blipFill>
          <p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="12192000" cy="6858000"/></a:xfrm></p:spPr>
        </p:pic>
      </p:sld>
    `, rels);

    expect(shapes).toHaveLength(2);
    expect(shapes[0]).toMatchObject({
      kind: "image",
      name: "图片 2",
      mediaTarget: "../media/image1.jpg",
    });
    expect(shapes[1]).toMatchObject({
      kind: "text",
      name: "标题 1",
      placeholderType: "ctrTitle",
      textSample: "部门复盘总结",
    });
  });
});
